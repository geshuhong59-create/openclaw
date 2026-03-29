import { setTimeout as delay } from "node:timers/promises";
import { FeedSourceConfig } from "../config.js";
import { RawTrendItem, TrendsProvider } from "../types.js";
import { evaluateTabExpression, openBrowserBridgeTab } from "../utils/browserBridge.js";
import { loadFeedEntries } from "../utils/feed.js";
import { fetchJson } from "../utils/http.js";
import { collapseWhitespace, createTitleFromText, excerpt } from "../utils/text.js";

interface XAiProviderOptions {
  bearerToken?: string;
  browserBridgeEndpoint?: string;
  browserEnabled: boolean;
  browserWaitMs: number;
  searchMode: "top" | "live";
  searchQuery: string;
  fallbackFeeds: FeedSourceConfig[];
  fallbackProvider?: TrendsProvider;
  timeoutMs: number;
}

interface XRecentSearchResponse {
  data?: Array<{
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
    lang?: string;
    public_metrics?: {
      like_count?: number;
      quote_count?: number;
      reply_count?: number;
      retweet_count?: number;
    };
  }>;
  includes?: {
    users?: Array<{
      id: string;
      username?: string;
      name?: string;
      verified?: boolean;
    }>;
  };
}

interface BrowserSearchItem {
  author: string;
  text: string;
  url: string;
  publishedAt?: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  viewCount: number;
}

interface TopicRule {
  label: string;
  tags: string[];
  patterns: RegExp[];
}

interface EnrichedBrowserSearchItem extends BrowserSearchItem {
  cleanedText: string;
  score: number;
}

const TOPIC_RULES: TopicRule[] = [
  {
    label: "Claude / Anthropic",
    tags: ["Claude", "Anthropic", "Agents"],
    patterns: [/claude\b/i, /anthropic\b/i, /claude code/i, /computer use/i, /cowork/i]
  },
  {
    label: "Grok / xAI",
    tags: ["Grok", "xAI"],
    patterns: [/\bgrok\b/i, /\bxai\b/i, /\bimagine\b/i]
  },
  {
    label: "OpenAI / ChatGPT",
    tags: ["OpenAI", "ChatGPT"],
    patterns: [/\bopenai\b/i, /\bchatgpt\b/i, /\bgpt-?\d/i, /\bsora\b/i]
  },
  {
    label: "Gemini / Google AI",
    tags: ["Gemini", "Google AI"],
    patterns: [/\bgemini\b/i, /google ai/i, /deepmind/i, /veo\b/i]
  },
  {
    label: "DeepSeek",
    tags: ["DeepSeek"],
    patterns: [/\bdeepseek\b/i]
  },
  {
    label: "GLM / Z.ai",
    tags: ["GLM", "Z.ai"],
    patterns: [/\bglm\b/i, /\bz\.ai\b/i, /\bzai\b/i]
  },
  {
    label: "AI Agents / Coding",
    tags: ["Agents", "Coding"],
    patterns: [/\bai agents?\b/i, /\bagents?\b/i, /\bcodex\b/i, /\bopencode\b/i, /\bopenclaw\b/i]
  }
];

function computeScore(
  metrics:
    | {
        like_count?: number;
        quote_count?: number;
        reply_count?: number;
        retweet_count?: number;
      }
    | undefined
): number {
  if (!metrics) return 0;
  return (
    (metrics.like_count ?? 0) +
    (metrics.reply_count ?? 0) * 2 +
    (metrics.quote_count ?? 0) * 2 +
    (metrics.retweet_count ?? 0) * 3
  );
}

function cleanBrowserTweetText(text: string): string {
  const trimTrailingLabels = (value: string): string =>
    collapseWhitespace(value).replace(/(?:(?:Coding Plan Max|OpenRouter|API)\s*:?\s*)+$/gi, "").trim();

  const normalizedText = collapseWhitespace(text.replace(/([.!?。！？])(?=[\u3400-\u9fff])/g, "$1 "));
  const firstCjkIndex = normalizedText.search(/[\u3400-\u9fff]/);
  if (firstCjkIndex > 0) {
    const englishPrefix = normalizedText.slice(0, firstCjkIndex).trim();
    const latinCount = (englishPrefix.match(/[A-Za-z]/g) ?? []).length;
    if (latinCount >= 24) {
      return trimTrailingLabels(englishPrefix);
    }
  }

  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => collapseWhitespace(line))
    .filter(Boolean);

  const sentenceFiltered = normalizedText
    .split(/(?<=[.!?。！？])\s*/)
    .map((sentence) => collapseWhitespace(sentence))
    .filter(Boolean)
    .filter((sentence) => {
      const latinCount = (sentence.match(/[A-Za-z]/g) ?? []).length;
      const cjkCount = (sentence.match(/[\u3400-\u9fff]/g) ?? []).length;
      return cjkCount === 0 || latinCount >= cjkCount;
    });

  if (sentenceFiltered.length > 0) {
    const collapsed = trimTrailingLabels(sentenceFiltered.join(" "));
    if (/[A-Za-z]/.test(collapsed)) {
      return collapsed;
    }
  }

  if (lines.length <= 1) return trimTrailingLabels(normalizedText);

  const latinLines = lines.filter((line) => /[A-Za-z]/.test(line));
  const cjkLines = lines.filter((line) => /[\u3400-\u9fff]/.test(line));

  if (latinLines.length > 0 && cjkLines.length > 0) {
    return collapseWhitespace(Array.from(new Set(latinLines)).join(" "));
  }

  return trimTrailingLabels(Array.from(new Set(lines)).join(" "));
}

function computeBrowserScore(item: BrowserSearchItem): number {
  return item.likeCount + item.replyCount * 2 + item.repostCount * 3 + Math.round(item.viewCount / 1000);
}

function buildBrowserSearchUrl(query: string, mode: "top" | "live"): string {
  const url = new URL("https://x.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("src", "typed_query");
  url.searchParams.set("f", mode);
  return url.toString();
}

function buildBrowserExtractionScript(limit: number): string {
  return `(() => {
    const parseCompactNumber = (text) => {
      const normalized = String(text || "").replace(/,/g, "").trim().toUpperCase();
      const match = normalized.match(/([0-9]+(?:\\.[0-9]+)?)([KMB])?/);
      if (!match) return 0;
      const value = Number(match[1]);
      const scale = match[2] === "K" ? 1e3 : match[2] === "M" ? 1e6 : match[2] === "B" ? 1e9 : 1;
      return Math.round(value * scale);
    };

    const extractTweetText = (article) => {
      const root = article.querySelector('div[data-testid="tweetText"]');
      if (!root) return "";
      const clone = root.cloneNode(true);
      clone.querySelectorAll("a").forEach((anchor) => {
        const text = (anchor.innerText || "").trim();
        if (/^https?:\\/\\//i.test(text) || /^[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/.test(text)) {
          anchor.remove();
        }
      });
      return clone.innerText || "";
    };

    const findStatusLink = (article) => {
      const links = Array.from(article.querySelectorAll("a[href]")).map((anchor) => anchor.href);
      return links.find((href) => /\\/status\\/\\d+/.test(href)) || "";
    };

    return Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
      .slice(0, ${Math.max(limit, 8)})
      .map((article) => {
        const userText = article.querySelector('div[data-testid="User-Name"]')?.innerText || "";
        const authorMatch = userText.match(/@([A-Za-z0-9_]+)/);
        return {
          author: authorMatch ? authorMatch[1] : "",
          text: extractTweetText(article),
          url: findStatusLink(article),
          publishedAt: article.querySelector("time")?.getAttribute("datetime") || "",
          likeCount: parseCompactNumber(article.querySelector('[data-testid="like"]')?.innerText || ""),
          repostCount: parseCompactNumber(article.querySelector('[data-testid="retweet"]')?.innerText || ""),
          replyCount: parseCompactNumber(article.querySelector('[data-testid="reply"]')?.innerText || ""),
          viewCount: parseCompactNumber(article.querySelector('[data-testid="viewCount"]')?.innerText || "")
        };
      })
      .filter((item) => item.text && item.url);
  })()`;
}

function matchTopicRule(text: string): TopicRule | undefined {
  return TOPIC_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));
}

function normalizeFallbackItems(items: RawTrendItem[]): RawTrendItem[] {
  return items.map((item) => ({
    ...item,
    source: item.source?.startsWith("x-ai") ? item.source : "x-ai/http-fallback",
    tags: Array.from(new Set(["AI", "X", ...(item.tags ?? [])]))
  }));
}

export class XAiProvider implements TrendsProvider {
  readonly name = "x-ai";

  constructor(private readonly options: XAiProviderOptions) {}

  async fetchTrends(limit: number): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];

    if (this.options.browserEnabled && this.options.browserBridgeEndpoint) {
      try {
        const browserItems = await this.fetchBrowserSearch(limit);
        if (browserItems.length > 0) {
          return browserItems;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[x-ai] browser search failed: ${message}`);
      }
    }

    if (this.options.bearerToken) {
      try {
        const officialItems = await this.fetchOfficialSearch(limit);
        if (officialItems.length > 0) {
          return officialItems;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[x-ai] official search failed: ${message}`);
      }
    }

    if (this.options.fallbackProvider) {
      try {
        const fallbackItems = await this.options.fallbackProvider.fetchTrends(limit);
        if (fallbackItems.length > 0) {
          return normalizeFallbackItems(fallbackItems).slice(0, limit);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[x-ai] HTTP fallback failed: ${message}`);
      }
    }

    if (this.options.fallbackFeeds.length > 0) {
      const feedItems = await Promise.all(
        this.options.fallbackFeeds.map(async (feed, index) => {
          try {
            const entries = await loadFeedEntries(feed, Math.max(limit, 3), this.options.timeoutMs);
            return entries.map((entry, entryIndex) => ({
              id: `${feed.label}-${entry.id || entryIndex + 1}-${index + 1}`,
              title: entry.title,
              description: entry.description,
              url: entry.url,
              score: Math.max(1, limit - entryIndex),
              tags: Array.from(new Set(["AI", "X", ...entry.tags])),
              source: `x-ai/feed/${feed.label}`,
              publishedAt: entry.publishedAt
            } satisfies RawTrendItem));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[x-ai] feed fallback ${feed.label} failed: ${message}`);
            return [];
          }
        })
      );

      return feedItems
        .flat()
        .sort((left, right) => {
          const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
          const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;
          return rightTime - leftTime;
        })
        .slice(0, limit);
    }

    return [];
  }

  private async fetchBrowserSearch(limit: number): Promise<RawTrendItem[]> {
    if (!this.options.browserBridgeEndpoint) return [];

    const tab = await openBrowserBridgeTab(
      this.options.browserBridgeEndpoint,
      buildBrowserSearchUrl(this.options.searchQuery, this.options.searchMode),
      this.options.timeoutMs
    );

    await delay(this.options.browserWaitMs);

    const candidates = await evaluateTabExpression<BrowserSearchItem[]>(
      tab.webSocketDebuggerUrl,
      buildBrowserExtractionScript(Math.max(limit * 3, 12))
    );

    const enrichedCandidates = candidates
      .map((candidate) => {
        const cleanedText = cleanBrowserTweetText(candidate.text);
        const score = computeBrowserScore(candidate);
        return {
          ...candidate,
          cleanedText,
          score
        } satisfies EnrichedBrowserSearchItem;
      })
      .filter((item) => {
        return item.cleanedText.length >= 24 && item.score > 0;
      })
      .sort((left, right) => right.score - left.score);

    const groupedItems = this.groupBrowserCandidates(enrichedCandidates, limit);
    if (groupedItems.length > 0) {
      return groupedItems;
    }

    return enrichedCandidates.slice(0, limit).map((candidate) => ({
      id: candidate.url,
      title: createTitleFromText(candidate.cleanedText, 96),
      description: excerpt(candidate.cleanedText, 280),
      url: candidate.url,
      score: candidate.score,
      tags: ["AI", "X", "Browser", this.options.searchMode === "top" ? "Top Search" : "Live Search"],
      source: "x-ai/browser-search",
      publishedAt: candidate.publishedAt,
      posts: [
        {
          author: candidate.author || "unknown",
          text: candidate.cleanedText,
          url: candidate.url,
          engagement: {
            likes: candidate.likeCount,
            reposts: candidate.repostCount,
            replies: candidate.replyCount
          }
        }
      ]
    }));
  }

  private groupBrowserCandidates(candidates: EnrichedBrowserSearchItem[], limit: number): RawTrendItem[] {
    const grouped = new Map<
      string,
      {
        label: string;
        tags: Set<string>;
        totalScore: number;
        best: EnrichedBrowserSearchItem;
        posts: EnrichedBrowserSearchItem[];
      }
    >();

    for (const candidate of candidates) {
      const rule = matchTopicRule(candidate.cleanedText);
      const label = rule?.label ?? createTitleFromText(candidate.cleanedText, 56);
      const existing = grouped.get(label);

      if (existing) {
        existing.totalScore += candidate.score;
        existing.posts.push(candidate);
        if (candidate.score > existing.best.score) {
          existing.best = candidate;
        }
        for (const tag of rule?.tags ?? []) {
          existing.tags.add(tag);
        }
      } else {
        grouped.set(label, {
          label,
          tags: new Set(["AI", "X", "Browser", ...(rule?.tags ?? [])]),
          totalScore: candidate.score,
          best: candidate,
          posts: [candidate]
        });
      }
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.totalScore - left.totalScore)
      .slice(0, limit)
      .map((group) => ({
        id: `${group.label}:${group.best.url}`,
        title: group.label,
        description: excerpt(group.best.cleanedText, 280),
        url: group.best.url,
        score: group.totalScore,
        tags: Array.from(group.tags).concat(this.options.searchMode === "top" ? ["Top Search"] : ["Live Search"]),
        source: "x-ai/browser-topics",
        publishedAt: group.best.publishedAt,
        posts: group.posts
          .sort((left, right) => right.score - left.score)
          .slice(0, 3)
          .map((post) => ({
            author: post.author || "unknown",
            text: post.cleanedText,
            url: post.url,
            engagement: {
              likes: post.likeCount,
              reposts: post.repostCount,
              replies: post.replyCount
            }
          }))
      }));
  }

  private async fetchOfficialSearch(limit: number): Promise<RawTrendItem[]> {
    const url = new URL("https://api.x.com/2/tweets/search/recent");
    url.searchParams.set("query", this.options.searchQuery);
    url.searchParams.set("tweet.fields", "created_at,public_metrics,author_id,lang");
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "username,name,verified");
    url.searchParams.set("max_results", String(Math.min(100, Math.max(limit * 3, 10))));

    const payload = await fetchJson<XRecentSearchResponse>(
      url,
      {
        headers: {
          Authorization: `Bearer ${this.options.bearerToken}`
        }
      },
      this.options.timeoutMs
    );

    const users = new Map((payload.includes?.users ?? []).map((user) => [user.id, user]));

    return (payload.data ?? [])
      .map((tweet) => {
        const author = tweet.author_id ? users.get(tweet.author_id) : undefined;
        const username = author?.username ?? "i";
        const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;
        const text = excerpt(tweet.text, 320);
        const score = computeScore(tweet.public_metrics);

        return {
          id: tweet.id,
          title: createTitleFromText(tweet.text, 96),
          description: text,
          url: tweetUrl,
          score,
          tags: Array.from(new Set(["AI", "X", tweet.lang ?? ""])).filter(Boolean),
          source: "x-ai/official-search",
          publishedAt: tweet.created_at,
          posts: [
            {
              author: username,
              text: tweet.text,
              url: tweetUrl,
              engagement: {
                likes: tweet.public_metrics?.like_count,
                reposts: tweet.public_metrics?.retweet_count,
                replies: tweet.public_metrics?.reply_count
              }
            }
          ]
        } satisfies RawTrendItem;
      })
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .slice(0, limit);
  }
}
