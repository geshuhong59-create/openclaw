import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type RadarConfigFile = {
  execution?: {
    branchPrefix?: string;
    targetBranch?: string;
    allowDeployTargets?: string[];
    denyProduction?: boolean;
    autoCreateBranch?: boolean;
    autoCommit?: boolean;
    autoPush?: boolean;
    autoCreatePr?: boolean;
    repository?: string;
    gitRemote?: string;
  };
};

function isPlaceholderRepository(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "owner/repo" ||
    normalized === "example/example-repo" ||
    normalized === "yourname/openclaw-workspace"
  );
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const byEquals = process.argv.find((item) => item.startsWith(prefix));
  if (byEquals) {
    return byEquals.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }

  return undefined;
}

function inferRepositoryFromUrl(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, "/");
  const match = normalized.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  return match?.[1] ?? null;
}

function toRemoteUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("://") || trimmed.startsWith("git@")) {
    return trimmed;
  }
  return `https://github.com/${trimmed}.git`;
}

async function runGit(repoRoot: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd: repoRoot });
  return `${result.stdout}`.trim();
}

async function getExistingOrigin(repoRoot: string): Promise<string | null> {
  try {
    return await runGit(repoRoot, ["remote", "get-url", "origin"]);
  } catch {
    return null;
  }
}

async function upsertOrigin(repoRoot: string, remoteUrl: string): Promise<"added" | "updated" | "unchanged"> {
  const existing = await getExistingOrigin(repoRoot);
  if (!existing) {
    await runGit(repoRoot, ["remote", "add", "origin", remoteUrl]);
    return "added";
  }
  if (existing === remoteUrl) {
    return "unchanged";
  }
  await runGit(repoRoot, ["remote", "set-url", "origin", remoteUrl]);
  return "updated";
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd());
  const configPath = path.join(repoRoot, "config", "ai-upgrade-radar.json");
  const repoInput =
    readArgValue("--repo-url") ??
    readArgValue("--repo") ??
    process.env.AI_RADAR_REMOTE_URL ??
    process.env.AI_RADAR_REPOSITORY;

  if (!repoInput) {
    throw new Error("Provide --repo-url=https://github.com/owner/repo.git or --repo=owner/repo");
  }

  const remoteUrl = toRemoteUrl(repoInput);
  const repository = inferRepositoryFromUrl(remoteUrl) ?? repoInput.replace(/\.git$/i, "");

  if (isPlaceholderRepository(repository)) {
    throw new Error("Refusing placeholder repository value. Replace owner/repo with the real GitHub repository.");
  }

  const enableAutoPush = hasFlag("--enable-auto-push");
  const enableAutoPr = hasFlag("--enable-auto-pr");
  const setOrigin = !hasFlag("--skip-origin");

  const raw = await readFile(configPath, "utf8");
  const config = JSON.parse(raw) as RadarConfigFile;
  config.execution = {
    ...(config.execution ?? {}),
    targetBranch: "staging",
    gitRemote: "origin",
    repository,
    autoPush: enableAutoPush || config.execution?.autoPush || false,
    autoCreatePr: enableAutoPr || config.execution?.autoCreatePr || false,
  };

  let originStatus: "added" | "updated" | "unchanged" | "skipped" = "skipped";
  if (setOrigin) {
    originStatus = await upsertOrigin(repoRoot, remoteUrl);
  }

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        repoRoot,
        repository,
        remoteUrl,
        originStatus,
        execution: config.execution,
        nextSteps: [
          "Set GITHUB_TOKEN before live GitHub API scans or PR creation.",
          "Ensure git push auth is available locally through Git Credential Manager or another credential helper.",
          enableAutoPush ? "Auto push is enabled in config." : "Auto push remains disabled until explicitly enabled.",
          enableAutoPr ? "Automatic PR creation is enabled in config." : "Automatic PR creation remains disabled until explicitly enabled.",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
