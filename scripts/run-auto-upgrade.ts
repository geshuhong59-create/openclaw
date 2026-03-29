import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { loadRadarRuntime, persistState, writeJsonFile } from "../.openclaw/extensions/github-architecture-radar/config.js";
import { runDailyRadarCycle } from "../.openclaw/extensions/github-architecture-radar/reporter.js";
import { DailyRadarResult, ExecutionRecord, RadarRuntime } from "../.openclaw/extensions/github-architecture-radar/types.js";

const execFileAsync = promisify(execFile);

type CandidateSelection = {
  candidateKey: string;
  repoFullName: string;
  releaseTag: string;
  branchName: string;
  reportPath: string;
};

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const byEquals = process.argv.find((item) => item.startsWith(prefix));
  if (byEquals) return byEquals.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }

  return undefined;
}

function chooseScriptPath(runtime: RadarRuntime, configuredPath: string | undefined, fallback: string | undefined): string | undefined {
  const candidate = configuredPath ?? fallback;
  if (!candidate) return undefined;
  const resolved = path.isAbsolute(candidate) ? candidate : path.join(runtime.paths.workspaceRoot, candidate);

  if (process.platform === "win32" && resolved.endsWith(".sh")) {
    return resolved.replace(/\.sh$/i, ".ps1");
  }

  if (process.platform !== "win32" && resolved.endsWith(".ps1")) {
    return resolved.replace(/\.ps1$/i, ".sh");
  }

  return resolved;
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

function envValue(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

async function ensureGitIdentity(runtime: RadarRuntime): Promise<void> {
  const cwd = runtime.paths.workspaceRoot;

  const existingName = await runGitCommand(["config", "user.name"], cwd).catch(() => "");
  const existingEmail = await runGitCommand(["config", "user.email"], cwd).catch(() => "");

  const fallbackName = envValue(
    process.env.GIT_AUTHOR_NAME,
    process.env.GIT_COMMITTER_NAME,
    process.env.GITHUB_ACTIONS === "true" ? "github-actions[bot]" : undefined,
  ) ?? "OpenClaw Radar";
  const fallbackEmail = envValue(
    process.env.GIT_AUTHOR_EMAIL,
    process.env.GIT_COMMITTER_EMAIL,
    process.env.GITHUB_ACTIONS === "true" ? "41898282+github-actions[bot]@users.noreply.github.com" : undefined,
  ) ?? "openclaw-radar@users.noreply.github.com";

  if (!existingName) {
    await runGitCommand(["config", "user.name", fallbackName], cwd);
  }

  if (!existingEmail) {
    await runGitCommand(["config", "user.email", fallbackEmail], cwd);
  }
}

function executable(name: string): string {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

async function runProcess(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  return process.platform === "win32" && command.toLowerCase().endsWith(".cmd")
    ? execFileAsync(
        "cmd.exe",
        ["/d", "/s", "/c", [command.replace(/\.cmd$/i, ""), ...args].join(" ")],
        { cwd, env },
      )
    : execFileAsync(command, args, { cwd, env });
}

async function commitAutomationChanges(
  runtime: RadarRuntime,
  candidateKey: string,
  label: string,
): Promise<{ committed: boolean; branchName?: string; commitSha?: string }> {
  if (!runtime.config.execution.autoCommit) {
    return { committed: false };
  }

  await runGitCommand(["add", "--", "config", "output", "reports", "state"], runtime.paths.workspaceRoot);

  try {
    await execFileAsync("git", ["diff", "--cached", "--quiet"], {
      cwd: runtime.paths.workspaceRoot,
      env: buildGitEnv(),
    });
    return { committed: false };
  } catch {
    // staged diff exists
  }

  await runGitCommand(["commit", "-m", `chore(radar): ${label} ${candidateKey}`], runtime.paths.workspaceRoot);
  const branchName = await runGitCommand(["branch", "--show-current"], runtime.paths.workspaceRoot);
  const commitSha = await runGitCommand(["rev-parse", "HEAD"], runtime.paths.workspaceRoot);

  if (runtime.config.execution.autoPush && branchName) {
    await runGitCommand(
      ["push", runtime.config.execution.gitRemote, `HEAD:${branchName}`],
      runtime.paths.workspaceRoot,
    );
  }

  return {
    committed: true,
    branchName: branchName || undefined,
    commitSha,
  };
}

async function promoteDeployTarget(runtime: RadarRuntime, extraEnv: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  return runProcess(executable("npx"), ["tsx", "scripts/promote-radar-deploy.ts"], runtime.paths.workspaceRoot, {
    ...process.env,
    ...extraEnv,
  });
}

async function ensureScriptExists(scriptPath: string): Promise<void> {
  await access(scriptPath);
}

function logStage(stage: string, detail?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[auto-upgrade][${timestamp}] ${stage}`);
  if (detail) {
    console.log(JSON.stringify(detail, null, 2));
  }
}

async function runConfiguredScript(
  scriptPath: string,
  runtime: RadarRuntime,
  extraEnv: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  const ext = path.extname(scriptPath).toLowerCase();
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv };

  if (ext === ".ps1") {
    return execFileAsync(
      "powershell",
      ["-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { cwd: runtime.paths.workspaceRoot, env },
    );
  }

  if (ext === ".sh") {
    return execFileAsync("bash", [scriptPath], { cwd: runtime.paths.workspaceRoot, env });
  }

  return execFileAsync(scriptPath, [], { cwd: runtime.paths.workspaceRoot, env });
}

function recordFailure(runtime: RadarRuntime, stage: string, message: string, candidateKey?: string): void {
  runtime.state.failureRegistry.failures.push({
    stage,
    message,
    retriable: true,
    candidateKey,
    occurredAt: runtime.now.toISOString(),
  });
  runtime.state.failureRegistry.updatedAt = runtime.now.toISOString();
}

function selectCandidate(result: DailyRadarResult): CandidateSelection | null {
  const firstPlanned = result.plannedCandidates[0];
  const firstExecution = result.executionRecords[0];
  if (!firstPlanned || !firstExecution) return null;

  return {
    candidateKey: firstExecution.candidateKey,
    repoFullName: firstPlanned.candidate.repo.fullName,
    releaseTag: firstPlanned.candidate.repo.latestRelease?.tagName ?? "no-release",
    branchName: firstExecution.branchName,
    reportPath: firstExecution.reportPath,
  };
}

async function writeAutomationArtifacts(
  runtime: RadarRuntime,
  executionRecord: ExecutionRecord | undefined,
  payload: unknown,
): Promise<void> {
  const baseDir = executionRecord
    ? path.dirname(executionRecord.reportPath)
    : path.join(runtime.paths.reportsDir, "upgrades", runtime.now.toISOString().slice(0, 10));

  await mkdir(baseDir, { recursive: true });
  await writeJsonFile(path.join(baseDir, "automation-result.json"), payload);
  await writeFile(path.join(baseDir, "automation-result.md"), `# Auto Upgrade Result\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`, "utf8");
}

async function main(): Promise<void> {
  const runtime = await loadRadarRuntime({
    workspaceRoot: path.resolve(process.cwd()),
    useFixtures: hasFlag("--fixtures") || process.env.AI_RADAR_USE_FIXTURES === "1",
  });

  await ensureGitIdentity(runtime);

  const dryRun = hasFlag("--dry-run");
  const reportDate = readArgValue("--report-date");
  const candidateLimit = readArgValue("--topN") ? Number(readArgValue("--topN")) : undefined;
  logStage("daily-cycle:start", {
    dryRun,
    reportDate,
    candidateLimit,
  });
  const result = await runDailyRadarCycle(runtime, {
    dryRun,
    reportDate,
    candidateLimit,
  });
  logStage("daily-cycle:complete", {
    discoveredCount: result.discoveredCount,
    plannedCandidates: result.plannedCandidates.length,
    executionRecords: result.executionRecords.length,
    reportPath: result.reportPath,
  });

  const selection = selectCandidate(result);
  if (!selection) {
    const payload = {
      status: "no-op",
      reason: "No candidate crossed the validation threshold.",
      executedAt: runtime.now.toISOString(),
      reportPath: result.reportPath,
    };
    await writeAutomationArtifacts(runtime, undefined, payload);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const extraEnv: NodeJS.ProcessEnv = {
    AI_RADAR_CANDIDATE_KEY: selection.candidateKey,
    AI_RADAR_CANDIDATE_REPO: selection.repoFullName,
    AI_RADAR_CANDIDATE_RELEASE: selection.releaseTag,
    AI_RADAR_BRANCH_NAME: selection.branchName,
    AI_RADAR_REPORT_PATH: selection.reportPath,
    AI_RADAR_DEPLOY_TARGET: runtime.config.execution.deployTarget ?? "staging",
  };

  const payload: Record<string, unknown> = {
    executedAt: runtime.now.toISOString(),
    candidateKey: selection.candidateKey,
    repo: selection.repoFullName,
    releaseTag: selection.releaseTag,
    dryRun,
    validation: { enabled: runtime.config.execution.autoValidate },
    applyUpgrade: { enabled: runtime.config.execution.autoApplyUpgrade },
    deploy: {
      enabled: runtime.config.execution.autoDeploy,
      target: runtime.config.execution.deployTarget ?? "staging",
    },
  };

  logStage("selected-candidate", {
    candidateKey: selection.candidateKey,
    repo: selection.repoFullName,
    releaseTag: selection.releaseTag,
    branchName: selection.branchName,
    reportPath: selection.reportPath,
    dryRun,
  });

  if (!dryRun && runtime.config.execution.autoValidate) {
    const validationScript = chooseScriptPath(runtime, runtime.config.execution.validationScript, process.platform === "win32" ? "scripts/test-upgrade.ps1" : "scripts/test-upgrade.sh");
    if (!validationScript) {
      throw new Error("No validation script is configured.");
    }
    await ensureScriptExists(validationScript);

    logStage("validation:start", { script: validationScript });
    const validationResult = await runConfiguredScript(validationScript, runtime, extraEnv);
    logStage("validation:complete", { script: validationScript });
    payload.validation = {
      enabled: true,
      script: validationScript,
      status: "passed",
      stdout: validationResult.stdout.trim(),
      stderr: validationResult.stderr.trim(),
    };
  }

  if (!dryRun && runtime.config.execution.autoApplyUpgrade) {
    const applyScript = chooseScriptPath(runtime, runtime.config.execution.applyUpgradeScript, undefined);
    if (!applyScript) {
      throw new Error("autoApplyUpgrade is enabled but no applyUpgradeScript is configured.");
    }
    await ensureScriptExists(applyScript);

    logStage("apply:start", { script: applyScript });
    const applyResult = await runConfiguredScript(applyScript, runtime, extraEnv);
    logStage("apply:complete", { script: applyScript });
    const applyUpgradePayload: Record<string, unknown> = {
      enabled: true,
      script: applyScript,
      status: "passed",
      stdout: applyResult.stdout.trim(),
      stderr: applyResult.stderr.trim(),
    };
    payload.applyUpgrade = applyUpgradePayload;

    logStage("apply:commit:start");
    const applyCommit = await commitAutomationChanges(runtime, selection.candidateKey, "apply");
    logStage("apply:commit:complete", applyCommit);
    payload.applyUpgrade = {
      ...applyUpgradePayload,
      committed: applyCommit.committed,
      branchName: applyCommit.branchName,
      commitSha: applyCommit.commitSha,
    };
  }

  if (!dryRun && runtime.config.execution.autoDeploy) {
    const deployTarget = runtime.config.execution.deployTarget ?? "staging";
    if (runtime.config.execution.allowDeployTargets.includes(deployTarget) === false) {
      throw new Error(`Refusing deploy target: ${deployTarget}`);
    }

    const deployScript = chooseScriptPath(runtime, runtime.config.execution.deployScript, undefined);
    if (!deployScript) {
      throw new Error("autoDeploy is enabled but no deployScript is configured.");
    }
    await ensureScriptExists(deployScript);

    logStage("deploy:start", { script: deployScript, target: deployTarget });
    const deployResult = await runConfiguredScript(deployScript, runtime, extraEnv);
    logStage("deploy:complete", { script: deployScript, target: deployTarget });
    const deployPayload: Record<string, unknown> = {
      enabled: true,
      script: deployScript,
      target: deployTarget,
      status: "passed",
      stdout: deployResult.stdout.trim(),
      stderr: deployResult.stderr.trim(),
    };
    payload.deploy = deployPayload;
  }

  await writeAutomationArtifacts(runtime, result.executionRecords[0], payload);

  logStage("automation-result:commit:start");
  const finalCommit = await commitAutomationChanges(runtime, selection.candidateKey, "record automation result");
  logStage("automation-result:commit:complete", finalCommit);
  if (finalCommit.committed) {
    payload.commit = finalCommit;
  }

  if (!dryRun && runtime.config.execution.autoDeploy) {
    logStage("promote:start", { target: runtime.config.execution.deployTarget ?? "staging" });
    const promoteResult = await promoteDeployTarget(runtime, extraEnv);
    logStage("promote:complete", { target: runtime.config.execution.deployTarget ?? "staging" });
    payload.deploy = {
      ...(payload.deploy as Record<string, unknown>),
      promoted: true,
      promotionStdout: promoteResult.stdout.trim(),
      promotionStderr: promoteResult.stderr.trim(),
    };
    await writeAutomationArtifacts(runtime, result.executionRecords[0], payload);
    logStage("promotion-result:commit:start");
    await commitAutomationChanges(runtime, selection.candidateKey, "record deploy promotion");
    logStage("promotion-result:commit:complete");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch(async (error) => {
  try {
    const runtime = await loadRadarRuntime({ workspaceRoot: path.resolve(process.cwd()) });
    const message = error instanceof Error ? error.message : String(error);
    recordFailure(runtime, "auto-upgrade", message);
    await persistState(runtime.paths, runtime.state);
  } catch {
    // Ignore secondary persistence failures.
  }

  console.error(error);
  process.exitCode = 1;
});
