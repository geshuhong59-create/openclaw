import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config.js";
import { normalizeTrends } from "./core/normalize.js";
import { toJson, toMarkdown } from "./output/render.js";
import { MockProvider } from "./providers/index.js";
import { MockTranslator } from "./translation/index.js";
import { TrendsProvider } from "./types.js";

function createProvider(name: string): TrendsProvider {
  switch (name) {
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unsupported provider: ${name}`);
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  const provider = createProvider(config.provider);
  const translator = new MockTranslator();

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
