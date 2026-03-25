import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { GitHubApiClient } from "./github-api.js";
import { createUpgradePlan, renderUpgradePlanMarkdown } from "./planner.js";
import { persistState, writeJsonFile } from "./config.js";
import { ExecutionRecord, RadarRuntime, ScoredCandidate, UpgradePlan } from "./types.js";

const execFileAsync = promisify(execFile);

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

  if (!token) {
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.proxy";
    env.GIT_CONFIG_VALUE_0 = "";
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
  return runtime.state.upgradeAttempts.attempts.some((attempt) => attempt.candidateKey === candidateKey);
}

function buildBranchName(runtime: RadarRuntime, candidate: ScoredCandidate): string {
  const datePart = runtime.now.toISOString().slice(0, 10);
  const targetPart = sanitizeBranchComponent(candidate.repo.fullName.split("/")[1] ?? candidate.repo.fullName);
  return `${runtime.config.execution.branchPrefix}/${datePart}-${targetPart}`;
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
  const branchName = buildBranchName(runtime, candidate);
  const reportDir = buildReportDirectory(runtime, branchName);
  const reportPath = path.join(reportDir, "UPGRADE_REPORT.md");
  const dryRun = options?.dryRun ?? false;

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
      await runGitCommand(["checkout", "-b", branchName], runtime.paths.workspaceRoot);
      status = "branch-created";
      message = `Created ${branchName}.`;
    }

    if (runtime.config.execution.autoCommit) {
      await runGitCommand(["add", reportPath, path.join(reportDir, "candidate.json")], runtime.paths.workspaceRoot);
      await runGitCommand(
        ["commit", "-m", `chore(radar): evaluate ${candidate.repo.fullName}`],
        runtime.paths.workspaceRoot,
      );
      commitSha = await runGitCommand(["rev-parse", "HEAD"], runtime.paths.workspaceRoot);
      status = "committed";
      message = `Committed upgrade artifacts on ${branchName}.`;
    }

    if (runtime.config.execution.autoPush) {
      await runGitCommand(
        ["push", "-u", runtime.config.execution.gitRemote, branchName],
        runtime.paths.workspaceRoot,
      );
      status = "pushed";
      message = `Pushed ${branchName} to ${runtime.config.execution.gitRemote}.`;
    }

    if (runtime.config.execution.autoCreatePr && runtime.config.execution.repository) {
      const client = new GitHubApiClient(runtime.config, runtime.paths, false);
      prUrl = await client.createPullRequest({
        repository: runtime.config.execution.repository,
        head: branchName,
        base: runtime.config.execution.targetBranch,
        title: `AI Radar upgrade experiment: ${candidate.repo.fullName}`,
        body: buildPrBody(candidate, plan),
      });
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

  return { plan, record };
}
