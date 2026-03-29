import { RawTrendItem, TrendsProvider } from "../types.js";
import { fetchJson, toIsoDate } from "../utils/http.js";
import { excerpt, stripHtml } from "../utils/text.js";

interface HackerNewsProviderOptions {
  storyType: "topstories" | "beststories" | "newstories";
  timeoutMs: number;
}

interface HackerNewsItem {
  id: number;
  by?: string;
  descendants?: number;
  dead?: boolean;
  deleted?: boolean;
  score?: number;
  text?: string;
  time?: number;
  title?: string;
  type?: string;
  url?: string;
}

function buildDiscussionUrl(id: number): string {
  return `https://news.ycombinator.com/item?id=${id}`;
}

export class HackerNewsProvider implements TrendsProvider {
  readonly name = "hacker-news";

  constructor(private readonly options: HackerNewsProviderOptions) {}

  async fetchTrends(limit: number): Promise<RawTrendItem[]> {
    if (limit <= 0) return [];

    const ids = await fetchJson<number[]>(
      `https://hacker-news.firebaseio.com/v0/${this.options.storyType}.json`,
      {},
      this.options.timeoutMs
    );

    const candidates = await Promise.all(
      ids.slice(0, Math.max(limit * 3, limit)).map(async (id) => {
        try {
          return await fetchJson<HackerNewsItem>(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
            {},
            this.options.timeoutMs
          );
        } catch {
          return null;
        }
      })
    );

    return candidates
      .filter((item): item is HackerNewsItem => Boolean(item) && item?.type === "story" && !item.dead && !item.deleted)
      .slice(0, limit)
      .map((item) => {
        const discussionUrl = buildDiscussionUrl(item.id);
        const description = item.text
          ? excerpt(stripHtml(item.text), 260)
          : `HN score ${item.score ?? 0}, ${item.descendants ?? 0} comments`;

        return {
          id: String(item.id),
          title: item.title ?? `HN item ${item.id}`,
          description,
          url: item.url ?? discussionUrl,
          score: (item.score ?? 0) + (item.descendants ?? 0) * 2,
          tags: ["Hacker News", this.options.storyType],
          source: `hacker-news/${this.options.storyType}`,
          publishedAt: toIsoDate(item.time ? item.time * 1000 : undefined),
          posts: item.by
            ? [
                {
                  author: item.by,
                  text: `HN score ${item.score ?? 0}, ${item.descendants ?? 0} comments`,
                  url: discussionUrl
                }
              ]
            : []
        } satisfies RawTrendItem;
      });
  }
}
