import { FeedSourceConfig } from "../config.js";
import { RawTrendItem, TrendsProvider } from "../types.js";
import { loadFeedEntries } from "../utils/feed.js";

interface AiArticlesProviderOptions {
  feeds: FeedSourceConfig[];
  timeoutMs: number;
}

function freshnessScore(publishedAt: string | undefined): number {
  if (!publishedAt) return 0;

  const publishedAtMs = Date.parse(publishedAt);
  if (Number.isNaN(publishedAtMs)) return 0;

  const hoursOld = Math.max(0, (Date.now() - publishedAtMs) / 3_600_000);
  return Math.max(1, Math.round(168 - hoursOld));
}

function splitLimit(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];

  const base = Math.floor(total / buckets);
  const remainder = total % buckets;

  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

export class AiArticlesProvider implements TrendsProvider {
  readonly name = "ai-articles";

  constructor(private readonly options: AiArticlesProviderOptions) {}

  async fetchTrends(limit: number): Promise<RawTrendItem[]> {
    if (limit <= 0 || this.options.feeds.length === 0) return [];

    const perFeedLimits = splitLimit(Math.max(limit, this.options.feeds.length), this.options.feeds.length).map((value) =>
      Math.max(1, value)
    );

    const batches = await Promise.all(
      this.options.feeds.map(async (feed, index) => {
        try {
          const entries = await loadFeedEntries(feed, perFeedLimits[index] + 2, this.options.timeoutMs);
          return entries.map((entry, entryIndex) => ({
            id: `${feed.label}-${entry.id || entryIndex + 1}`,
            title: entry.title,
            description: entry.description,
            url: entry.url,
            score: freshnessScore(entry.publishedAt),
            tags: Array.from(new Set(["AI", "Article", ...entry.tags])),
            source: `ai-article/${feed.label}`,
            publishedAt: entry.publishedAt
          } satisfies RawTrendItem));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[ai-articles] ${feed.label} failed: ${message}`);
          return [];
        }
      })
    );

    return batches
      .flat()
      .sort((left, right) => {
        const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
        const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;
        return rightTime - leftTime;
      })
      .slice(0, limit);
  }
}
