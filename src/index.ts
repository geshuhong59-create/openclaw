import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config.js";
import { normalizeTrends } from "./core/normalize.js";
import { toJson, toMarkdown } from "./output/render.js";
import { HttpProvider, MockProvider } from "./providers/index.js";
import { MockTranslator, PassthroughTranslator } from "./translation/index.js";
import { Translator, TrendsProvider } from "./types.js";

function createProvider(config: ReturnType<typeof getConfig>): TrendsProvider {
  switch (config.provider) {
    case "mock":
      return new MockProvider();
    case "http":
      if (!config.httpEndpoint) {
        throw new Error("X_TRENDS_HTTP_ENDPOINT is required when provider=http");
      }
      return new HttpProvider({
        endpoint: config.httpEndpoint,
        apiKey: config.httpApiKey,
        apiHost: config.httpApiHost
      });
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
