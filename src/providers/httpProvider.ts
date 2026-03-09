import { RawTrendItem, TrendsProvider } from "../types.js";

interface HttpProviderOptions {
  endpoint: string;
  apiKey?: string;
  apiHost?: string;
}

interface GenericApiResponse {
  data?: Array<Record<string, unknown>>;
  trends?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
}

function pickArray(payload: GenericApiResponse): Array<Record<string, unknown>> {
  return payload.data ?? payload.trends ?? payload.items ?? [];
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export class HttpProvider implements TrendsProvider {
  readonly name = "http";

  constructor(private readonly options: HttpProviderOptions) {}

  async fetchTrends(limit: number): Promise<RawTrendItem[]> {
    const headers: Record<string, string> = {
      Accept: "application/json"
    };

    if (this.options.apiKey) {
      headers.Authorization = `Bearer ${this.options.apiKey}`;
      headers["X-API-Key"] = this.options.apiKey;
    }

    if (this.options.apiHost) {
      headers["X-RapidAPI-Host"] = this.options.apiHost;
    }

    const url = new URL(this.options.endpoint);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP provider request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GenericApiResponse;
    const rows = pickArray(payload).slice(0, limit);

    return rows.map((row, index) => ({
      id: String(row.id ?? row.trend_id ?? index + 1),
      title: String(row.title ?? row.name ?? row.keyword ?? `trend-${index + 1}`),
      description: typeof row.description === "string" ? row.description : undefined,
      url: typeof row.url === "string" ? row.url : undefined,
      score: toNumber(row.score ?? row.heat ?? row.volume),
      tags: toStringArray(row.tags),
      source: typeof row.source === "string" ? row.source : "http-provider",
      posts: Array.isArray(row.posts)
        ? row.posts
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .slice(0, 3)
            .map((post) => ({
              author: String(post.author ?? post.username ?? "unknown"),
              text: String(post.text ?? post.content ?? ""),
              url: typeof post.url === "string" ? post.url : undefined,
              engagement: {
                likes: toNumber(post.likes),
                reposts: toNumber(post.reposts),
                replies: toNumber(post.replies)
              }
            }))
        : []
    }));
  }
}
