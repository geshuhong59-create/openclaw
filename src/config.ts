import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface FeedSourceConfig {
  label: string;
  url: string;
  tags: string[];
}

export interface AppConfig {
  provider: string;
  limit: number;
  translator: string;
  httpEndpoint?: string;
  httpApiKey?: string;
  httpApiHost?: string;
  requestTimeoutMs: number;
  browserBridgeEndpoint?: string;
  xBearerToken?: string;
  xBrowserEnabled: boolean;
  xBrowserWaitMs: number;
  xSearchMode: "top" | "live";
  xSearchQuery: string;
  xFallbackFeeds: FeedSourceConfig[];
  aiArticleFeeds: FeedSourceConfig[];
  hnStoryType: "topstories" | "beststories" | "newstories";
}

interface RuntimeArchitectureProfile {
  version?: number;
  updatedAt?: string | null;
  runtime?: Partial<{
    provider: AppConfig["provider"];
    limit: number;
    requestTimeoutMs: number;
    xBrowserEnabled: boolean;
    xBrowserWaitMs: number;
    xSearchMode: AppConfig["xSearchMode"];
    xSearchQuery: string;
    xFallbackFeeds: FeedSourceConfig[];
    aiArticleFeeds: FeedSourceConfig[];
    hnStoryType: AppConfig["hnStoryType"];
  }>;
}

const DEFAULT_X_SEARCH_QUERY =
  '(OpenAI OR Anthropic OR Claude OR Gemini OR DeepSeek OR Grok OR LLM OR "AI agents" OR "AI model") min_faves:20 lang:en -is:retweet -is:reply';
const DEFAULT_RUNTIME_PROFILE_PATH = path.resolve(process.cwd(), "config", "runtime-architecture.json");

const DEFAULT_AI_FEEDS: FeedSourceConfig[] = [
  {
    label: "openai-news",
    url: "https://openai.com/news/rss.xml",
    tags: ["AI", "Article", "OpenAI"]
  },
  {
    label: "deepmind-blog",
    url: "https://deepmind.google/blog/rss.xml",
    tags: ["AI", "Article", "DeepMind"]
  },
  {
    label: "microsoft-research-blog",
    url: "https://www.microsoft.com/en-us/research/blog/feed/",
    tags: ["AI", "Article", "Research", "Microsoft Research"]
  }
];

function isFeedSourceConfig(value: unknown): value is FeedSourceConfig {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as FeedSourceConfig).label === "string" &&
      typeof (value as FeedSourceConfig).url === "string" &&
      Array.isArray((value as FeedSourceConfig).tags),
  );
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function valuePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function valueBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function deriveLabel(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return url.hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  } catch {
    return "feed";
  }
}

function parseFeedSources(value: string | undefined, fallback: FeedSourceConfig[]): FeedSourceConfig[] {
  if (!value?.trim()) return fallback;

  return value
    .split(/[\r\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");
      const label = separatorIndex >= 0 ? entry.slice(0, separatorIndex).trim() : deriveLabel(entry);
      const url = separatorIndex >= 0 ? entry.slice(separatorIndex + 1).trim() : entry;

      return {
        label: label || deriveLabel(url),
        url,
        tags: []
      } satisfies FeedSourceConfig;
    });
}

function parseStoryType(value: string | undefined): AppConfig["hnStoryType"] {
  if (value === "beststories" || value === "newstories") return value;
  return "topstories";
}

function valueStoryType(value: unknown, fallback: AppConfig["hnStoryType"]): AppConfig["hnStoryType"] {
  if (value === "beststories" || value === "newstories" || value === "topstories") return value;
  return fallback;
}

function parseSearchMode(value: string | undefined): AppConfig["xSearchMode"] {
  return value === "live" ? "live" : "top";
}

function valueSearchMode(value: unknown, fallback: AppConfig["xSearchMode"]): AppConfig["xSearchMode"] {
  return value === "live" || value === "top" ? value : fallback;
}

function readRuntimeProfile(): RuntimeArchitectureProfile {
  try {
    if (!existsSync(DEFAULT_RUNTIME_PROFILE_PATH)) {
      return {};
    }

    const raw = readFileSync(DEFAULT_RUNTIME_PROFILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as RuntimeArchitectureProfile)
      : {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[config] failed to load runtime architecture profile: ${message}`);
    return {};
  }
}

export function getConfig(): AppConfig {
  const runtimeProfile = readRuntimeProfile().runtime ?? {};
  const runtimeXFallbackFeeds = Array.isArray(runtimeProfile.xFallbackFeeds)
    ? runtimeProfile.xFallbackFeeds.filter(isFeedSourceConfig)
    : [];
  const runtimeAiArticleFeeds = Array.isArray(runtimeProfile.aiArticleFeeds)
    ? runtimeProfile.aiArticleFeeds.filter(isFeedSourceConfig)
    : DEFAULT_AI_FEEDS;

  return {
    provider:
      process.env.X_TRENDS_PROVIDER ??
      (typeof runtimeProfile.provider === "string" ? runtimeProfile.provider : "aggregate"),
    limit: parsePositiveNumber(process.env.X_TRENDS_LIMIT, valuePositiveNumber(runtimeProfile.limit, 12)),
    translator: process.env.X_TRENDS_TRANSLATOR ?? "passthrough",
    httpEndpoint: process.env.X_TRENDS_HTTP_ENDPOINT,
    httpApiKey: process.env.X_TRENDS_HTTP_API_KEY,
    httpApiHost: process.env.X_TRENDS_HTTP_API_HOST,
    requestTimeoutMs: parsePositiveNumber(
      process.env.X_TRENDS_REQUEST_TIMEOUT_MS,
      valuePositiveNumber(runtimeProfile.requestTimeoutMs, 20_000),
    ),
    browserBridgeEndpoint: process.env.X_TRENDS_BROWSER_BRIDGE_ENDPOINT ?? "http://127.0.0.1:9334",
    xBearerToken: process.env.X_TRENDS_X_BEARER_TOKEN,
    xBrowserEnabled: parseBoolean(
      process.env.X_TRENDS_X_BROWSER_ENABLED,
      valueBoolean(runtimeProfile.xBrowserEnabled, true),
    ),
    xBrowserWaitMs: parsePositiveNumber(
      process.env.X_TRENDS_X_BROWSER_WAIT_MS,
      valuePositiveNumber(runtimeProfile.xBrowserWaitMs, 8_000),
    ),
    xSearchMode: process.env.X_TRENDS_X_SEARCH_MODE
      ? parseSearchMode(process.env.X_TRENDS_X_SEARCH_MODE)
      : valueSearchMode(runtimeProfile.xSearchMode, "top"),
    xSearchQuery: process.env.X_TRENDS_X_SEARCH_QUERY ?? runtimeProfile.xSearchQuery ?? DEFAULT_X_SEARCH_QUERY,
    xFallbackFeeds: parseFeedSources(process.env.X_TRENDS_X_FALLBACK_FEEDS, runtimeXFallbackFeeds),
    aiArticleFeeds: parseFeedSources(process.env.X_TRENDS_AI_ARTICLE_FEEDS, runtimeAiArticleFeeds),
    hnStoryType: process.env.X_TRENDS_HN_STORY_TYPE
      ? parseStoryType(process.env.X_TRENDS_HN_STORY_TYPE)
      : valueStoryType(runtimeProfile.hnStoryType, "topstories")
  };
}
