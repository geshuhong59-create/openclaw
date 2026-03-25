import path from "node:path";
import { loadRadarRuntime } from "../.openclaw/extensions/github-architecture-radar/config.js";
import { runDailyRadarCycle } from "../.openclaw/extensions/github-architecture-radar/reporter.js";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const entry = process.argv.find((item) => item.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd());
  const runtime = await loadRadarRuntime({
    workspaceRoot,
    useFixtures: hasFlag("--fixtures") || process.env.AI_RADAR_USE_FIXTURES === "1",
  });
  const result = await runDailyRadarCycle(runtime, {
    dryRun: hasFlag("--dry-run"),
    reportDate: readArgValue("--report-date"),
    candidateLimit: readArgValue("--topN") ? Number(readArgValue("--topN")) : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
