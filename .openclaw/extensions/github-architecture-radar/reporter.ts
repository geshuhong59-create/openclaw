import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeUpgradePlan } from "./executor.js";
import { persistState, writeJsonFile } from "./config.js";
import { createUpgradePlan } from "./planner.js";
import { scoreCandidates } from "./scorer.js";
import { scanRepositories } from "./scanner.js";
import { DailyRadarResult, RadarRuntime, RunRadarOptions, ScoredCandidate } from "./types.js";

function reportDate(runtime: RadarRuntime, override?: string): string {
  return override ?? runtime.now.toISOString().slice(0, 10);
}

function topCandidatesSection(candidates: ScoredCandidate[]): string {
  if (candidates.length === 0) {
    return "- No candidates discovered.";
  }

  return candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.repo.fullName} | score=${candidate.score.finalUpgradeScore} | release=${candidate.repo.latestRelease?.tagName ?? "none"} | vetoes=${candidate.score.hardVetoReasons.join(",") || "none"}`,
    )
    .join("\n");
}

function executiveSummarySection(result: DailyRadarResult): string {
  const winner = result.topCandidates[0];
  const eligibleCount = result.topCandidates.filter((candidate) => candidate.score.eligibleForValidation).length;
  const failedCount = result.executionRecords.filter((record) => record.status === "failed").length;
  const prCreatedCount = result.executionRecords.filter((record) => record.status === "pr-created").length;

  return [
    `- Winner: ${winner ? `${winner.repo.fullName}@${winner.repo.latestRelease?.tagName ?? "none"} (score ${winner.score.finalUpgradeScore})` : "none"}`,
    `- Eligible candidates in today's shortlist: ${eligibleCount}/${result.topCandidates.length}`,
    `- Planned upgrade executions: ${result.executionRecords.length}`,
    `- Failed execution records: ${failedCount}`,
    `- Auto-created upgrade PRs during planning: ${prCreatedCount}`,
  ].join("\n");
}

function topCandidatesTable(candidates: ScoredCandidate[]): string {
  if (candidates.length === 0) {
    return "| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| - | - | - | - | - | - | - | - |";
  }

  const rows = candidates.map((candidate, index) => {
    const vetoes = candidate.score.hardVetoReasons.length ? candidate.score.hardVetoReasons.join(", ") : "none";
    return `| ${index + 1} | ${candidate.repo.fullName} | ${candidate.score.finalUpgradeScore} | ${candidate.repo.latestRelease?.tagName ?? "none"} | ${candidate.score.estimatedPerformanceGainPct}% | ${candidate.score.estimatedCostReductionPct}% | ${candidate.score.eligibleForValidation ? "yes" : "no"} | ${vetoes} |`;
  });

  return [
    "| Rank | Repo | Score | Release | Perf Gain | Cost Down | Eligible | Vetoes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function executionSection(result: DailyRadarResult): string {
  if (result.executionRecords.length === 0) {
    return "- No upgrade plans crossed the execution threshold.";
  }

  return result.executionRecords
    .map((record) => {
      const details = [
        `status=${record.status}`,
        `branch=${record.branchName}`,
        record.prUrl ? `pr=${record.prUrl}` : undefined,
        record.commitSha ? `commit=${record.commitSha}` : undefined,
      ]
        .filter(Boolean)
        .join(" | ");

      return `- ${record.candidateKey} | ${details}\n  note: ${record.message}`;
    })
    .join("\n");
}

export function renderDailyReport(result: DailyRadarResult): string {
  const discoveryLines = result.topCandidates
    .map((candidate) => `- ${candidate.repo.fullName}: ${candidate.score.summary.join("; ")}`)
    .join("\n");
  const executionLines = executionSection(result);
  const failureLines = result.failures.length
    ? result.failures.map((failure) => `- ${failure.stage}: ${failure.message}`).join("\n")
    : "- No failures recorded.";
  const recommendationLines = result.recommendations.map((item) => `- ${item}`).join("\n");

  return `# AI Architecture Radar Daily Report\n\n- Executed at: ${result.executedAt}\n- Discovered candidates: ${result.discoveredCount}\n- Report path: ${result.reportPath}\n\n## Executive Summary\n${executiveSummarySection(result)}\n\n## Top Candidate Scoreboard\n${topCandidatesTable(result.topCandidates)}\n\n## Top Candidates\n${topCandidatesSection(result.topCandidates)}\n\n## Discovery Notes\n${discoveryLines || "- No discovery notes."}\n\n## Planned Execution\n${executionLines}\n\n## Failures\n${failureLines}\n\n## Recommendations\n${recommendationLines}\n`;
}

export async function runDailyRadarCycle(
  runtime: RadarRuntime,
  options?: RunRadarOptions,
): Promise<DailyRadarResult> {
  const repos = await scanRepositories(runtime);
  const scored = scoreCandidates(repos, runtime.config);
  const limitedTopCandidates = scored.slice(0, options?.candidateLimit ?? runtime.config.reporting.topN);

  const plannedCandidates = limitedTopCandidates
    .filter((candidate) => candidate.score.eligibleForValidation)
    .map((candidate) => ({ candidate, plan: createUpgradePlan(candidate, runtime.config) }));

  const executionRecords = [];
  for (const { candidate } of plannedCandidates) {
    const executed = await executeUpgradePlan(runtime, candidate, { dryRun: options?.dryRun ?? false });
    executionRecords.push(executed.record);
  }

  const recommendations = [
    executionRecords.some((record) => record.status === "failed")
      ? "Review failed upgrade attempts before the next daily cycle."
      : "No failed upgrade attempts require immediate action.",
    executionRecords.some((record) => record.status === "pr-created")
      ? "Review newly opened staging PRs and decide whether to promote to canary."
      : "No PR was opened automatically in this run.",
    "Production remains gated and must keep environment protection rules enabled.",
  ];

  const reportPath = path.join(
    runtime.paths.reportsDir,
    `${reportDate(runtime, options?.reportDate)}-${runtime.config.reporting.reportFilenamePrefix}.md`,
  );

  runtime.state.seenRepos.updatedAt = runtime.now.toISOString();
  runtime.state.releaseHistory.updatedAt = runtime.now.toISOString();
  runtime.state.candidateHistory.updatedAt = runtime.now.toISOString();

  for (const candidate of scored) {
    runtime.state.seenRepos.repos[candidate.repo.fullName] = {
      lastSeenAt: runtime.now.toISOString(),
      lastReleaseTag: candidate.repo.latestRelease?.tagName ?? null,
      lastScoredAt: runtime.now.toISOString(),
    };
    runtime.state.releaseHistory.releases[candidate.repo.fullName] = candidate.repo.latestRelease
      ? [
          {
            tagName: candidate.repo.latestRelease.tagName,
            publishedAt: candidate.repo.latestRelease.publishedAt,
          },
        ]
      : [];
    runtime.state.candidateHistory.candidates.push({
      repo: candidate.repo.fullName,
      score: candidate.score.finalUpgradeScore,
      eligibleForValidation: candidate.score.eligibleForValidation,
      hardVetoReasons: candidate.score.hardVetoReasons,
      executedAt: runtime.now.toISOString(),
    });
  }

  const result: DailyRadarResult = {
    executedAt: runtime.now.toISOString(),
    reportPath,
    discoveredCount: repos.length,
    topCandidates: limitedTopCandidates,
    plannedCandidates,
    executionRecords,
    failures: runtime.state.failureRegistry.failures.filter(
      (failure) => failure.occurredAt.slice(0, 10) === runtime.now.toISOString().slice(0, 10),
    ),
    recommendations,
  };

  await mkdir(runtime.paths.reportsDir, { recursive: true });
  await writeFile(reportPath, renderDailyReport(result), "utf8");
  await writeFile(path.join(runtime.paths.reportsDir, "latest-ai-radar.md"), renderDailyReport(result), "utf8");
  await writeJsonFile(path.join(runtime.paths.reportsDir, "latest-ai-radar.json"), result);
  await persistState(runtime.paths, runtime.state);

  return result;
}
