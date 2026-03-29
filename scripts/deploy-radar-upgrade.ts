import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function toRepoPath(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  return (relative || ".").replace(/\\/g, "/");
}

function resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.join(workspaceRoot, targetPath);
}

function sanitizedEnv(extraEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...extraEnv }).filter(([, value]) => value !== undefined),
  ) as NodeJS.ProcessEnv;
}

function executable(name: string): string {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

async function runCommand(command: string, args: string[], cwd: string): Promise<string> {
  const env = sanitizedEnv();
  const result =
    process.platform === "win32" && command.toLowerCase().endsWith(".cmd")
      ? await execFileAsync(
          "cmd.exe",
          ["/d", "/s", "/c", [command.replace(/\.cmd$/i, ""), ...args].join(" ")],
          { cwd, env },
        )
      : await execFileAsync(command, args, { cwd, env });
  return `${result.stdout}`.trim();
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd());
  const reportPathInput = process.env.AI_RADAR_REPORT_PATH ?? "";
  const reportPath = reportPathInput ? resolveWorkspacePath(workspaceRoot, reportPathInput) : "";
  const reportDir = reportPath ? path.dirname(reportPath) : path.join(workspaceRoot, "reports", "upgrades", "unknown");

  await runCommand(executable("npm"), ["run", "build"], workspaceRoot);
  await runCommand(executable("npm"), ["run", "build:radar"], workspaceRoot);
  await runCommand("node", ["dist/index.js"], workspaceRoot);

  const trendsJsonPath = path.join(workspaceRoot, "output", "trends.json");
  const trendsMarkdownPath = path.join(workspaceRoot, "output", "trends.md");
  const trends = JSON.parse(await readFile(trendsJsonPath, "utf8")) as unknown;
  const markdown = await readFile(trendsMarkdownPath, "utf8");

  if (!Array.isArray(trends) || trends.length === 0) {
    throw new Error("Deployment smoke check failed: output/trends.json is empty.");
  }

  if (!markdown.includes("#")) {
    throw new Error("Deployment smoke check failed: output/trends.md looks incomplete.");
  }

  const payload = {
    deployedAt: new Date().toISOString(),
    candidateKey: process.env.AI_RADAR_CANDIDATE_KEY ?? "unknown",
    branchName: process.env.AI_RADAR_BRANCH_NAME ?? "unknown",
    deployTarget: process.env.AI_RADAR_DEPLOY_TARGET ?? "staging",
    trendCount: trends.length,
    outputFiles: [trendsJsonPath, trendsMarkdownPath].map((filePath) => toRepoPath(workspaceRoot, filePath)),
  };

  await writeJson(path.join(workspaceRoot, "state", "deployment_smoke.json"), payload);
  await writeJson(path.join(reportDir, "deployment-smoke.json"), payload);

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
