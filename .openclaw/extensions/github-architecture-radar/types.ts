export type ChangeType =
  | "dependency-upgrade"
  | "provider-replacement"
  | "tool-plugin-integration"
  | "workflow-optimization"
  | "inference-framework-replacement";

export type RiskLevel = "low" | "medium" | "high";

export type AllowedLicense =
  | "Apache-2.0"
  | "BSD-2-Clause"
  | "BSD-3-Clause"
  | "ISC"
  | "MIT"
  | "MPL-2.0";

export type RadarConfig = {
  watchRepos: string[];
  watchTopics: string[];
  topicsSearchLimit: number;
  scoreThreshold: number;
  minimumQualifyingSignals: number;
  compatibilityFloor: number;
  performanceGainFloorPct: number;
  costReductionFloorPct: number;
  approvedPaths: string[];
  github: {
    apiBaseUrl: string;
    restVersion: string;
    tokenEnv: string;
  };
  reporting: {
    topN: number;
    reportFilenamePrefix: string;
  };
  execution: {
    branchPrefix: string;
    targetBranch: string;
    allowDeployTargets: Array<"staging" | "canary">;
    denyProduction: boolean;
    autoCreateBranch: boolean;
    autoCommit: boolean;
    autoPush: boolean;
    autoCreatePr: boolean;
    autoValidate: boolean;
    autoApplyUpgrade: boolean;
    autoDeploy: boolean;
    validationScript?: string;
    applyUpgradeScript?: string;
    deployScript?: string;
    deployTarget?: "staging" | "canary";
    repository?: string;
    gitRemote: string;
  };
  scoreWeights: {
    maturity: number;
    compatibility: number;
    performancePotential: number;
    maintenanceRisk: number;
    adoptionSignal: number;
  };
  allowedLicenses: string[];
  currentArchitecture: {
    runtime: string[];
    deliveryTargets: string[];
    guardrails: string[];
  };
};

export type RuntimePaths = {
  workspaceRoot: string;
  configFile: string;
  reportsDir: string;
  stateDir: string;
  fixturesDir: string;
};

export type LatestRelease = {
  tagName: string;
  name: string;
  htmlUrl: string;
  publishedAt: string;
  prerelease: boolean;
  draft: boolean;
  body?: string;
};

export type RepoSnapshot = {
  fullName: string;
  url: string;
  description: string;
  topics: string[];
  stars: number;
  forks: number;
  defaultBranch: string;
  updatedAt: string;
  pushedAt: string;
  license: string | null;
  readme: string;
  recentCommitCount30d: number;
  latestRelease: LatestRelease | null;
  source: Array<{ kind: "watch_repo" | "topic"; value: string }>;
};

export type HardVetoReason =
  | "license_unknown"
  | "license_incompatible"
  | "breaking_change_high_risk"
  | "no_test_path"
  | "auth_model_changed"
  | "production_secret_impact"
  | "benchmark_unverifiable";

export type QualifyingSignals = {
  activeLast30Days: boolean;
  hasStableRelease: boolean;
  commercialLicense: boolean;
  documentationComplete: boolean;
  compatibilityAtLeast70: boolean;
  projectedPerformanceGainAtLeast15Pct: boolean;
  projectedCostReductionAtLeast10Pct: boolean;
  avoidsProductionSecurityBoundary: boolean;
};

export type CandidateScore = {
  maturityScore: number;
  compatibilityScore: number;
  performancePotentialScore: number;
  maintenanceRiskScore: number;
  adoptionSignalScore: number;
  finalUpgradeScore: number;
  estimatedPerformanceGainPct: number;
  estimatedCostReductionPct: number;
  hardVetoReasons: HardVetoReason[];
  qualifyingSignals: QualifyingSignals;
  qualifyingSignalCount: number;
  eligibleForValidation: boolean;
  summary: string[];
};

export type ScoredCandidate = {
  repo: RepoSnapshot;
  score: CandidateScore;
};

export type UpgradePlan = {
  target: string;
  changeType: ChangeType;
  riskLevel: RiskLevel;
  filesToChange: string[];
  summary: string;
  rollbackPlan: string[];
  validationChecklist: string[];
  humanEscalations: string[];
};

export type ExecutionRecord = {
  candidateKey: string;
  status:
    | "planned"
    | "dry-run"
    | "branch-created"
    | "committed"
    | "pushed"
    | "pr-created"
    | "failed"
    | "skipped";
  branchName: string;
  reportPath: string;
  commitSha?: string;
  prUrl?: string;
  message: string;
  executedAt: string;
};

export type DailyRadarResult = {
  executedAt: string;
  reportPath: string;
  discoveredCount: number;
  topCandidates: ScoredCandidate[];
  plannedCandidates: Array<{ candidate: ScoredCandidate; plan: UpgradePlan }>;
  executionRecords: ExecutionRecord[];
  failures: Array<{ stage: string; message: string; retriable: boolean; candidateKey?: string }>;
  recommendations: string[];
};

export type SeenReposState = {
  version: 1;
  updatedAt: string | null;
  repos: Record<
    string,
    {
      lastSeenAt: string;
      lastReleaseTag: string | null;
      lastScoredAt: string | null;
    }
  >;
};

export type ReleaseHistoryState = {
  version: 1;
  updatedAt: string | null;
  releases: Record<string, Array<{ tagName: string; publishedAt: string }>>;
};

export type CandidateHistoryState = {
  version: 1;
  updatedAt: string | null;
  candidates: Array<{
    repo: string;
    score: number;
    eligibleForValidation: boolean;
    hardVetoReasons: HardVetoReason[];
    executedAt: string;
  }>;
};

export type UpgradeAttemptsState = {
  version: 1;
  updatedAt: string | null;
  attempts: ExecutionRecord[];
};

export type LastSuccessfulVersionState = {
  version: 1;
  updatedAt: string | null;
  environments: Partial<
    Record<
      "staging" | "canary",
      {
        candidateKey: string;
        version: string;
        recordedAt: string;
        branchName: string;
      }
    >
  >;
};

export type FailureRegistryState = {
  version: 1;
  updatedAt: string | null;
  failures: Array<{
    stage: string;
    message: string;
    retriable: boolean;
    candidateKey?: string;
    occurredAt: string;
  }>;
};

export type RadarStateBundle = {
  seenRepos: SeenReposState;
  releaseHistory: ReleaseHistoryState;
  candidateHistory: CandidateHistoryState;
  upgradeAttempts: UpgradeAttemptsState;
  lastSuccessfulVersion: LastSuccessfulVersionState;
  failureRegistry: FailureRegistryState;
};

export type RadarRuntime = {
  config: RadarConfig;
  paths: RuntimePaths;
  state: RadarStateBundle;
  now: Date;
  useFixtures: boolean;
};

export type RunRadarOptions = {
  dryRun?: boolean;
  reportDate?: string;
  candidateLimit?: number;
};
