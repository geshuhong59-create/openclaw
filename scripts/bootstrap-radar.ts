import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

async function runGit(repoRoot: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd: repoRoot });
  return `${result.stdout}`.trim();
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function getCredentialHelper(repoRoot: string): Promise<string | null> {
  try {
    return await runGit(repoRoot, ["config", "--get", "credential.helper"]);
  } catch {
    return null;
  }
}

function isPlaceholderRepository(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === "owner/repo" ||
    normalized === "example/example-repo" ||
    normalized === "yourname/openclaw-workspace"
  );
}

function inferGithubRepo(remoteUrl: string | null): string | null {
  if (!remoteUrl) {
    return null;
  }

  const normalized = remoteUrl.replace(/\\/g, "/");
  const match = normalized.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  return match?.[1] ?? null;
}

async function ensureLocalBranch(repoRoot: string, branchName: string): Promise<"created" | "existing"> {
  try {
    await runGit(repoRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`]);
    return "existing";
  } catch {
    await runGit(repoRoot, ["branch", branchName, "HEAD"]);
    return "created";
  }
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd());
  const branchName = "staging";
  const branchStatus = await ensureLocalBranch(repoRoot, branchName);
  const credentialHelper = await getCredentialHelper(repoRoot);

  let remoteOrigin: string | null = null;
  try {
    remoteOrigin = await runGit(repoRoot, ["remote", "get-url", "origin"]);
  } catch {
    remoteOrigin = null;
  }

  const githubCliInstalled = await commandExists("gh");
  const githubTokenPresent = Boolean(process.env.GITHUB_TOKEN);
  const rawInferredRepository = process.env.AI_RADAR_REPOSITORY ?? inferGithubRepo(remoteOrigin);
  const inferredRepository = isPlaceholderRepository(rawInferredRepository) ? null : rawInferredRepository;
  const configPath = path.join(repoRoot, "config", "ai-upgrade-radar.json");
  const config = JSON.parse(await readFile(configPath, "utf8")) as {
    execution?: { repository?: string; targetBranch?: string; autoPush?: boolean; autoCreatePr?: boolean };
  };
  const configuredRepository = isPlaceholderRepository(config.execution?.repository ?? null)
    ? null
    : (config.execution?.repository ?? null);
  const remoteOriginIsPlaceholder = isPlaceholderRepository(inferGithubRepo(remoteOrigin));

  const recommendedNextSteps: string[] = [];
  if (!remoteOrigin) {
    recommendedNextSteps.push("Add an origin remote before enabling auto push or automatic PR creation.");
  } else if (remoteOriginIsPlaceholder) {
    recommendedNextSteps.push("Replace the placeholder origin remote with the real GitHub repository URL.");
  }
  if (!githubCliInstalled) {
    recommendedNextSteps.push("Install GitHub CLI if you want interactive PR workflows or easy auth checks.");
  }
  if (!githubTokenPresent) {
    recommendedNextSteps.push("Export GITHUB_TOKEN for GitHub REST API scanning and PR creation.");
  }
  if (!credentialHelper) {
    recommendedNextSteps.push("Configure a git credential helper before enabling automatic push from local cron runs.");
  }
  if (!inferredRepository && !configuredRepository) {
    recommendedNextSteps.push("Set AI_RADAR_REPOSITORY or config.execution.repository to owner/repo.");
  }

  console.log(
    JSON.stringify(
      {
        repoRoot,
        stagingBranch: {
          name: branchName,
          status: branchStatus,
        },
        remoteOrigin,
        remoteOriginIsPlaceholder,
        credentialHelper,
        githubCliInstalled,
        githubTokenPresent,
        inferredRepository,
        configuredRepository,
        targetBranch: config.execution?.targetBranch ?? "staging",
        autoPush: config.execution?.autoPush ?? false,
        autoCreatePr: config.execution?.autoCreatePr ?? false,
        recommendedNextSteps,
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
