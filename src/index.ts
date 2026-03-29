import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FeedSourceConfig, getConfig } from "./config.js";
import { normalizeTrends } from "./core/normalize.js";
import { toJson, toMarkdown } from "./output/render.js";
import {
  AggregateProvider,
  AiArticlesProvider,
  HackerNewsProvider,
  HttpProvider,
  MockProvider,
  XAiProvider
} from "./providers/index.js";
import { MockTranslator, PassthroughTranslator } from "./translation/index.js";
import { Translator, TrendsProvider } from "./types.js";

function createHttpFallback(config: ReturnType<typeof getConfig>): TrendsProvider | undefined {
  if (!config.httpEndpoint) return undefined;

  return new HttpProvider({
    endpoint: config.httpEndpoint,
    apiKey: config.httpApiKey,
    apiHost: config.httpApiHost,
    timeoutMs: config.requestTimeoutMs
  });
}

function withDefaultFeedTags(feeds: FeedSourceConfig[], ...baseTags: string[]): FeedSourceConfig[] {
  return feeds.map((feed) => ({
    ...feed,
    tags: Array.from(new Set([...baseTags, ...feed.tags]))
  }));
}

function createProvider(config: ReturnType<typeof getConfig>): TrendsProvider {
  const httpFallback = createHttpFallback(config);
  const xProvider = new XAiProvider({
    bearerToken: config.xBearerToken,
    browserBridgeEndpoint: config.browserBridgeEndpoint,
    browserEnabled: config.xBrowserEnabled,
    browserWaitMs: config.xBrowserWaitMs,
    searchQuery: config.xSearchQuery,
    searchMode: config.xSearchMode,
    fallbackFeeds: withDefaultFeedTags(config.xFallbackFeeds, "AI", "X"),
    fallbackProvider: httpFallback,
    timeoutMs: config.requestTimeoutMs
  });
  const aiArticlesProvider = new AiArticlesProvider({
    feeds: withDefaultFeedTags(config.aiArticleFeeds, "AI", "Article"),
    timeoutMs: config.requestTimeoutMs
  });
  const hackerNewsProvider = new HackerNewsProvider({
    storyType: config.hnStoryType,
    timeoutMs: config.requestTimeoutMs
  });

  switch (config.provider) {
    case "mock":
      return new MockProvider();
    case "http":
      if (!httpFallback) {
        throw new Error("X_TRENDS_HTTP_ENDPOINT is required when provider=http");
      }
      return httpFallback;
    case "x-ai":
      return xProvider;
    case "ai-articles":
      return aiArticlesProvider;
    case "hacker-news":
      return hackerNewsProvider;
    case "aggregate":
      return new AggregateProvider([xProvider, aiArticlesProvider, hackerNewsProvider]);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

function createTranslator(name: string): Translator {
  switch (name) {
    case "mock":
      return new MockTranslator();
    case "passthrough":
      return new PassthroughTranslator();
    default:
      throw new Error(`Unsupported translator: ${name}`);
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  const provider = createProvider(config);
  const translator = createTranslator(config.translator);

  const rawItems = await provider.fetchTrends(config.limit);
  const records = await normalizeTrends(rawItems, translator);

  const outputDir = path.resolve("output");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "trends.json"), toJson(records), "utf8");
  await writeFile(path.join(outputDir, "trends.md"), toMarkdown(records), "utf8");

  console.log(`Generated ${records.length} trend records using provider: ${provider.name}`);
  console.log(`Output directory: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
