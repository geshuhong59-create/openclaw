import { CandidateScore, HardVetoReason, QualifyingSignals, RadarConfig, RepoSnapshot, ScoredCandidate } from "./types.js";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0;
  }
  return clampScore((value / maxValue) * 100);
}

function inferDocsCompleteness(readme: string): boolean {
  const lowered = readme.toLowerCase();
  return readme.length >= 800 && /install|usage|quickstart|benchmark|release|roadmap/.test(lowered);
}

function inferBenchmarkSignals(repo: RepoSnapshot): boolean {
  const text = `${repo.description}\n${repo.readme}\n${repo.latestRelease?.body ?? ""}`.toLowerCase();
  return /benchmark|latency|throughput|tokens\/s|qps|eval|accuracy/.test(text);
}

function inferBreakingChangeRisk(repo: RepoSnapshot): boolean {
  const text = `${repo.latestRelease?.body ?? ""}\n${repo.readme}`.toLowerCase();
  return /breaking change|migration required|incompatible|v2 upgrade guide|v3 upgrade guide/.test(text);
}

function inferAuthImpact(repo: RepoSnapshot): boolean {
  const text = `${repo.description}\n${repo.readme}\n${repo.latestRelease?.body ?? ""}`.toLowerCase();
  return /oauth|token rotation|credential migration|secret rotation|auth flow/.test(text);
}

function estimateCompatibility(repo: RepoSnapshot, config: RadarConfig): number {
  const topics = new Set(repo.topics.map((topic) => topic.toLowerCase()));
  const stackOverlap = config.currentArchitecture.runtime.filter((item) => topics.has(item.toLowerCase())).length;
  const watchTopicOverlap = config.watchTopics.filter((topic) => topics.has(topic.toLowerCase())).length;
  const sourceBoost = repo.source.some((item) => item.kind === "watch_repo") ? 18 : 0;

  return clampScore(35 + stackOverlap * 12 + watchTopicOverlap * 8 + sourceBoost);
}

function estimatePerformanceGain(repo: RepoSnapshot): number {
  const text = `${repo.description}\n${repo.readme}\n${repo.latestRelease?.body ?? ""}`.toLowerCase();
  let score = 8;

  if (/benchmark|latency|throughput|optimized|faster|efficient/.test(text)) {
    score += 18;
  }
  if (/vllm|serving|inference|quantization|gpu/.test(text)) {
    score += 10;
  }
  if (repo.stars >= 5000) {
    score += 6;
  }

  return clampScore(score);
}

function estimateCostReduction(repo: RepoSnapshot): number {
  const text = `${repo.description}\n${repo.readme}\n${repo.latestRelease?.body ?? ""}`.toLowerCase();
  let pct = 4;

  if (/lower cost|reduced memory|memory footprint|cheaper|compression|quantization/.test(text)) {
    pct += 10;
  }
  if (/inference|serving|throughput|batching/.test(text)) {
    pct += 5;
  }

  return pct;
}

function classifyHardVetoReasons(repo: RepoSnapshot, config: RadarConfig): HardVetoReason[] {
  const vetoes: HardVetoReason[] = [];
  const license = repo.license ?? "";

  if (!license || license === "NOASSERTION") {
    vetoes.push("license_unknown");
  } else if (!config.allowedLicenses.includes(license as never)) {
    vetoes.push("license_incompatible");
  }

  if (inferBreakingChangeRisk(repo)) {
    vetoes.push("breaking_change_high_risk");
  }

  if (!inferBenchmarkSignals(repo)) {
    vetoes.push("benchmark_unverifiable");
  }

  if (inferAuthImpact(repo)) {
    vetoes.push("auth_model_changed", "production_secret_impact");
  }

  return [...new Set(vetoes)];
}

function buildQualifyingSignals(
  repo: RepoSnapshot,
  compatibilityScore: number,
  estimatedPerformanceGainPct: number,
  estimatedCostReductionPct: number,
  config: RadarConfig,
): QualifyingSignals {
  return {
    activeLast30Days: repo.recentCommitCount30d >= 4,
    hasStableRelease: Boolean(repo.latestRelease && !repo.latestRelease.prerelease && !repo.latestRelease.draft),
    commercialLicense: Boolean(repo.license && config.allowedLicenses.includes(repo.license as never)),
    documentationComplete: inferDocsCompleteness(repo.readme),
    compatibilityAtLeast70: compatibilityScore >= config.compatibilityFloor,
    projectedPerformanceGainAtLeast15Pct:
      estimatedPerformanceGainPct >= config.performanceGainFloorPct,
    projectedCostReductionAtLeast10Pct: estimatedCostReductionPct >= config.costReductionFloorPct,
    avoidsProductionSecurityBoundary: true,
  };
}

export function scoreCandidate(repo: RepoSnapshot, config: RadarConfig): ScoredCandidate {
  const maturityScore = clampScore(
    25 +
      normalize(Math.min(repo.recentCommitCount30d, 20), 20) * 0.35 +
      (repo.latestRelease ? 20 : 0) +
      (inferDocsCompleteness(repo.readme) ? 15 : 0),
  );
  const compatibilityScore = estimateCompatibility(repo, config);
  const performancePotentialScore = estimatePerformanceGain(repo);
  const maintenanceRiskScore = clampScore(
    70 -
      normalize(Math.min(repo.recentCommitCount30d, 20), 20) * 0.3 -
      (repo.latestRelease ? 12 : 0) -
      (repo.license ? 8 : -12) +
      (inferBreakingChangeRisk(repo) ? 20 : 0),
  );
  const adoptionSignalScore = clampScore(
    normalize(Math.min(repo.stars, 20000), 20000) * 0.65 +
      normalize(Math.min(repo.forks, 4000), 4000) * 0.2 +
      normalize(Math.min(repo.recentCommitCount30d, 20), 20) * 0.15,
  );

  const estimatedPerformanceGainPct = clampScore(Math.max(performancePotentialScore - 5, 0));
  const estimatedCostReductionPct = estimateCostReduction(repo);
  const hardVetoReasons = classifyHardVetoReasons(repo, config);
  const qualifyingSignals = buildQualifyingSignals(
    repo,
    compatibilityScore,
    estimatedPerformanceGainPct,
    estimatedCostReductionPct,
    config,
  );
  const qualifyingSignalCount = Object.values(qualifyingSignals).filter(Boolean).length;
  const finalUpgradeScore = clampScore(
    maturityScore * config.scoreWeights.maturity +
      compatibilityScore * config.scoreWeights.compatibility +
      performancePotentialScore * config.scoreWeights.performancePotential +
      adoptionSignalScore * config.scoreWeights.adoptionSignal +
      (100 - maintenanceRiskScore) * config.scoreWeights.maintenanceRisk,
  );
  const eligibleForValidation =
    finalUpgradeScore >= config.scoreThreshold &&
    qualifyingSignalCount >= config.minimumQualifyingSignals &&
    hardVetoReasons.length === 0;

  const summary = [
    `Active commits in last 30 days: ${repo.recentCommitCount30d}`,
    `Latest release: ${repo.latestRelease?.tagName ?? "none"}`,
    `License: ${repo.license ?? "unknown"}`,
    `Projected performance gain: ${estimatedPerformanceGainPct}%`,
    `Projected cost reduction: ${estimatedCostReductionPct}%`,
  ];

  const score: CandidateScore = {
    maturityScore,
    compatibilityScore,
    performancePotentialScore,
    maintenanceRiskScore,
    adoptionSignalScore,
    finalUpgradeScore,
    estimatedPerformanceGainPct,
    estimatedCostReductionPct,
    hardVetoReasons,
    qualifyingSignals,
    qualifyingSignalCount,
    eligibleForValidation,
    summary,
  };

  return { repo, score };
}

export function scoreCandidates(repos: RepoSnapshot[], config: RadarConfig): ScoredCandidate[] {
  return repos
    .map((repo) => scoreCandidate(repo, config))
    .sort((left, right) => right.score.finalUpgradeScore - left.score.finalUpgradeScore);
}
