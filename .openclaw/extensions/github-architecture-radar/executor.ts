import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { GitHubApiClient } from "./github-api.js";
import { createUpgradePlan, renderUpgradePlanMarkdown } from "./planner.js";
import { persistState, writeJsonFile } from "./config.js";
import { ExecutionRecord, RadarRuntime, ScoredCandidate, UpgradePlan } from "./types.js";

const execFileAsync = promisify(execFile);

function logExecutionStage(stage: string, detail?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[ai-radar][executor][${timestamp}] ${stage}`);
  if (detail) {
    console.log(JSON.stringify(detail, null, 2));
  }
}

function sanitizeBranchComponent(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/\/+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildGitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const token = process.env.GITHUB_TOKEN;

  env.GIT_CONFIG_COUNT = "1";
  env.GIT_CONFIG_KEY_0 = "http.proxy";
  env.GIT_CONFIG_VALUE_0 = "";

  if (!token || process.env.GITHUB_ACTIONS === "true") {
    return env;
  }

  const basicAuth = Buffer.from(`x-access-token:${token}`).toString("base64");
  env.GIT_CONFIG_COUNT = "2";
  env.GIT_CONFIG_KEY_0 = "http.proxy";
  env.GIT_CONFIG_VALUE_0 = "";
  env.GIT_CONFIG_KEY_1 = "http.https://github.com/.extraheader";
  env.GIT_CONFIG_VALUE_1 = `AUTHORIZATION: basic ${basicAuth}`;
  return env;
}

async function runGitCommand(args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, env: buildGitEnv() });
  return `${result.stdout}`.trim();
}

function hasPriorAttempt(runtime: RadarRuntime, candidateKey: string): boolean {
  return runtime.state.upgradeAttempts.attempts.some(
    (attempt) =>
      attempt.candidateKey === candidateKey &&
      ["branch-created", "committed", "pushed", "pr-created"].includes(attempt.status),
  );
}

async function refExists(cwd: string, ref: string): Promise<boolean> {
  try {
    await runGitCommand(["show-ref", "--verify", "--quiet", ref], cwd);
    return true;
  } catch {
    return false;
  }
}

async function resolveBaseRef(runtime: RadarRuntime): Promise<string> {
  const remoteRef = `refs/remotes/${runtime.config.execution.gitRemote}/${runtime.config.execution.targetBranch}`;
  if (await refExists(runtime.paths.workspaceRoot, remoteRef)) {
    return `${runtime.config.execution.gitRemote}/${runtime.config.execution.targetBranch}`;
  }

  const localRef = `refs/heads/${runtime.config.execution.targetBranch}`;
  if (await refExists(runtime.paths.workspaceRoot, localRef)) {
    return runtime.config.execution.targetBranch;
  }

  return "HEAD";
}

function buildBranchName(runtime: RadarRuntime, candidate: ScoredCandidate): string {
  const datePart = runtime.now.toISOString().slice(0, 10);
  const targetPart = sanitizeBranchComponent(candidate.repo.fullName.split("/")[1] ?? candidate.repo.fullName);
  return `${runtime.config.execution.branchPrefix}/${datePart}-${targetPart}`;
}

async function remoteBranchExists(runtime: RadarRuntime, branchName: string): Promise<boolean> {
  try {
    await runGitCommand(
      ["ls-remote", "--exit-code", "--heads", runtime.config.execution.gitRemote, branchName],
      runtime.paths.workspaceRoot,
    );
    return true;
  } catch {
    return false;
  }
}

async function resolveBranchName(runtime: RadarRuntime, candidate: ScoredCandidate): Promise<string> {
  const baseBranchName = buildBranchName(runtime, candidate);
  if (!(await remoteBranchExists(runtime, baseBranchName))) {
    return baseBranchName;
  }

  const retrySuffix = runtime.now.toISOString().slice(11, 19).replace(/:/g, "");
  return `${baseBranchName}-${retrySuffix}`;
}

function buildReportDirectory(runtime: RadarRuntime, branchName: string): string {
  const safeName = sanitizeBranchComponent(branchName);
  return path.join(runtime.paths.reportsDir, "upgrades", safeName);
}

function buildPrBody(candidate: ScoredCandidate, plan: UpgradePlan): string {
  return [
    "## Summary",
    plan.summary,
    "",
    "## Candidate Signals",
    ...candidate.score.summary.map((item) => `- ${item}`),
    "",
    "## Validation Checklist",
    ...plan.validationChecklist.map((item) => `- ${item}`),
    "",
    "## Rollback Plan",
    ...plan.rollbackPlan.map((item) => `- ${item}`),
  ].join("\n");
}

async function writePrArtifacts(
  runtime: RadarRuntime,
  candidate: ScoredCandidate,
  plan: UpgradePlan,
  branchName: string,
  reportDir: string,
): Promise<{ bodyPath: string; metadataPath: string }> {
  const bodyPath = path.join(reportDir, "PR_BODY.md");
  const metadataPath = path.join(reportDir, "pr-metadata.json");
  const title = `AI Radar upgrade experiment: ${candidate.repo.fullName}`;
  const body = buildPrBody(candidate, plan);

  await writeFile(bodyPath, body, "utf8");
  await writeJsonFile(metadataPath, {
    title,
    repository: runtime.config.execution.repository ?? null,
    head: branchName,
    base: runtime.config.execution.targetBranch,
    autoCreatePr: runtime.config.execution.autoCreatePr,
    autoPush: runtime.config.execution.autoPush,
    createdAt: runtime.now.toISOString(),
  });

  return { bodyPath, metadataPath };
}

export async function executeUpgradePlan(
  runtime: RadarRuntime,
  candidate: ScoredCandidate,
  options?: { dryRun?: boolean },
): Promise<{ plan: UpgradePlan; record: ExecutionRecord }> {
  const plan = createUpgradePlan(candidate, runtime.config);
  const candidateKey = `${candidate.repo.fullName}@${candidate.repo.latestRelease?.tagName ?? "no-release"}`;
  const branchName = await resolveBranchName(runtime, candidate);
  const reportDir = buildReportDirectory(runtime, branchName);
  const reportPath = path.join(reportDir, "UPGRADE_REPORT.md");
  const dryRun = options?.dryRun ?? false;

  logExecutionStage("candidate:start", {
    candidateKey,
    branchName,
    dryRun,
  });

  await mkdir(reportDir, { recursive: true });
  await writeFile(reportPath, renderUpgradePlanMarkdown(candidate, plan), "utf8");
  await writeJsonFile(path.join(reportDir, "candidate.json"), candidate);
  const prArtifacts = await writePrArtifacts(runtime, candidate, plan, branchName, reportDir);

  if (hasPriorAttempt(runtime, candidateKey)) {
    const record: ExecutionRecord = {
      candidateKey,
      status: "skipped",
      branchName,
      reportPath,
      message: "Skipped because this candidate version already has an upgrade attempt recorded.",
      executedAt: runtime.now.toISOString(),
    };
    runtime.state.upgradeAttempts.attempts.push(record);
    runtime.state.upgradeAttempts.updatedAt = runtime.now.toISOString();
    await persistState(runtime.paths, runtime.state);
    return { plan, record };
  }

  if (dryRun) {
    const record: ExecutionRecord = {
      candidateKey,
      status: "dry-run",
      branchName,
      reportPath,
      message: `Prepared branch, report, and PR artifacts in dry-run mode (${prArtifacts.bodyPath}).`,
      executedAt: runtime.now.toISOString(),
    };
    runtime.state.upgradeAttempts.attempts.push(record);
    runtime.state.upgradeAttempts.updatedAt = runtime.now.toISOString();
    await persistState(runtime.paths, runtime.state);
    return { plan, record };
  }

  let status: ExecutionRecord["status"] = "planned";
  let message = "Prepared upgrade plan.";
  let commitSha: string | undefined;
  let prUrl: string | undefined;

  try {
    if (runtime.config.execution.autoCreateBranch) {
      const baseRef = await resolveBaseRef(runtime);
      logExecutionStage("branch:create:start", { candidateKey, branchName, baseRef });
      await runGitCommand(["checkout", "-b", branchName, baseRef], runtime.paths.workspaceRoot);
      logExecutionStage("branch:create:complete", { candidateKey, branchName, baseRef });
      status = "branch-created";
      message = `Created ${branchName} from ${baseRef}.`;
    }

    if (runtime.config.execution.autoCommit) {
      logExecutionStage("commit:start", { candidateKey, branchName, reportPath });
      await runGitCommand(["add", reportPath, path.join(reportDir, "candidate.json")], runtime.paths.workspaceRoot);
      await runGitCommand(
        ["commit", "-m", `chore(radar): evaluate ${candidate.repo.fullName}`],
        runtime.paths.workspaceRoot,
      );
      commitSha = await runGitCommand(["rev-parse", "HEAD"], runtime.paths.workspaceRoot);
      logExecutionStage("commit:complete", { candidateKey, branchName, commitSha });
      status = "committed";
      message = `Committed upgrade artifacts on ${branchName}.`;
    }

    if (runtime.config.execution.autoPush) {
      logExecutionStage("push:start", { candidateKey, branchName, remote: runtime.config.execution.gitRemote });
      await runGitCommand(
        ["push", "-u", runtime.config.execution.gitRemote, branchName],
        runtime.paths.workspaceRoot,
      );
      logExecutionStage("push:complete", { candidateKey, branchName, remote: runtime.config.execution.gitRemote });
      status = "pushed";
      message = `Pushed ${branchName} to ${runtime.config.execution.gitRemote}.`;
    }

    if (runtime.config.execution.autoCreatePr && runtime.config.execution.repository) {
      logExecutionStage("pr:create:start", {
        candidateKey,
        repository: runtime.config.execution.repository,
        head: branchName,
        base: runtime.config.execution.targetBranch,
      });
      const client = new GitHubApiClient(runtime.config, runtime.paths, false);
      prUrl = await client.createPullRequest({
        repository: runtime.config.execution.repository,
        head: branchName,
        base: runtime.config.execution.targetBranch,
        title: `AI Radar upgrade experiment: ${candidate.repo.fullName}`,
        body: buildPrBody(candidate, plan),
      });
      logExecutionStage("pr:create:complete", { candidateKey, prUrl });
      status = "pr-created";
      message = `Created PR targeting ${runtime.config.execution.targetBranch}.`;
    } else if (runtime.config.execution.autoCreatePr && !runtime.config.execution.repository) {
      message = `PR creation requested but execution.repository is not configured. Draft is ready at ${prArtifacts.bodyPath}.`;
    } else if (!runtime.config.execution.autoCreatePr) {
      message = `${message} PR draft is ready at ${prArtifacts.bodyPath}.`;
    }
  } catch (error) {
    status = "failed";
    message = error instanceof Error ? error.message : String(error);
    logExecutionStage("candidate:failed", { candidateKey, message });
    runtime.state.failureRegistry.failures.push({
      stage: "executor",
      message,
      retriable: true,
      candidateKey,
      occurredAt: runtime.now.toISOString(),
    });
    runtime.state.failureRegistry.updatedAt = runtime.now.toISOString();
  }

  const record: ExecutionRecord = {
    candidateKey,
    status,
    branchName,
    reportPath,
    commitSha,
    prUrl,
    message,
    executedAt: runtime.now.toISOString(),
  };

  runtime.state.upgradeAttempts.attempts.push(record);
  runtime.state.upgradeAttempts.updatedAt = runtime.now.toISOString();
  await persistState(runtime.paths, runtime.state);
  logExecutionStage("candidate:complete", {
    candidateKey,
    status,
    branchName,
    commitSha,
    prUrl,
  });

  return { plan, record };
}
