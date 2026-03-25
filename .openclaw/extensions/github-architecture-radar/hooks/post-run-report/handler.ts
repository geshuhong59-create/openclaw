import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type HookContext = {
  workspaceDir?: string;
};

export default async function handle(_payload: unknown, ctx?: HookContext): Promise<void> {
  const workspaceRoot = ctx?.workspaceDir ? path.resolve(ctx.workspaceDir) : process.cwd();
  const latestReportPath = path.join(workspaceRoot, "reports", "latest-ai-radar.json");
  const pointerPath = path.join(workspaceRoot, "reports", "latest-ai-radar-pointer.json");

  try {
    const report = JSON.parse(await readFile(latestReportPath, "utf8")) as { reportPath?: string; executedAt?: string };
    await writeFile(
      pointerPath,
      `${JSON.stringify(
        {
          reportPath: report.reportPath ?? latestReportPath,
          executedAt: report.executedAt ?? null,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch {
    // Ignore missing report files so the hook never blocks the main flow.
  }
}
