import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CandidateHistoryState,
  FailureRegistryState,
  LastSuccessfulVersionState,
  RadarConfig,
  RadarRuntime,
  RadarStateBundle,
  ReleaseHistoryState,
  RuntimePaths,
  SeenReposState,
  UpgradeAttemptsState,
} from "./types.js";

const CONFIG_RELATIVE_PATH = path.join("config", "ai-upgrade-radar.json");

const DEFAULT_CONFIG: RadarConfig = {
  watchRepos: [
    "openai/openai-agents-python",
    "browser-use/browser-use",
    "microsoft/autogen",
    "langchain-ai/langgraph",
    "vllm-project/vllm",
  ],
  watchTopics: [
    "llm-inference",
    "model-serving",
    "agent-framework",
    "mcp",
    "browser-automation",
    "tool-use",
    "benchmark",
    "evals",
    "multi-agent",
    "workflow-automation",
  ],
  topicsSearchLimit: 8,
  scoreThreshold: 72,
  minimumQualifyingSignals: 4,
  compatibilityFloor: 70,
  performanceGainFloorPct: 15,
  costReductionFloorPct: 10,
  approvedPaths: [
    ".openclaw/extensions",
    ".github/workflows",
    "config",
    "output",
    "reports",
    "scripts",
    "state",
  ],
  github: {
    apiBaseUrl: "https://api.github.com",
    restVersion: "2022-11-28",
    tokenEnv: "GITHUB_TOKEN",
  },
  reporting: {
    topN: 5,
    reportFilenamePrefix: "ai-radar",
  },
  execution: {
    branchPrefix: "upgrade",
    targetBranch: "staging",
    allowDeployTargets: ["staging", "canary"],
    denyProduction: true,
    autoCreateBranch: true,
    autoCommit: true,
    autoPush: false,
    autoCreatePr: false,
    autoValidate: true,
    autoApplyUpgrade: true,
    autoDeploy: true,
    validationScript: "scripts/test-upgrade.sh",
    applyUpgradeScript: "scripts/ai-radar-apply-upgrade.sh",
    deployScript: "scripts/ai-radar-deploy.sh",
    deployTarget: "staging",
    gitRemote: "origin",
  },
  scoreWeights: {
    maturity: 0.22,
    compatibility: 0.26,
    performancePotential: 0.18,
    maintenanceRisk: 0.16,
    adoptionSignal: 0.18,
  },
  allowedLicenses: ["Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MIT", "MPL-2.0"],
  currentArchitecture: {
    runtime: ["typescript", "nodejs", "github-actions", "openclaw"],
    deliveryTargets: ["staging", "canary"],
    guardrails: ["no-production-auto-deploy", "no-direct-main-merge", "secrets-externalized"],
  },
};

const EMPTY_SEEN_REPOS: SeenReposState = { version: 1, updatedAt: null, repos: {} };
const EMPTY_RELEASE_HISTORY: ReleaseHistoryState = { version: 1, updatedAt: null, releases: {} };
const EMPTY_CANDIDATE_HISTORY: CandidateHistoryState = { version: 1, updatedAt: null, candidates: [] };
const EMPTY_UPGRADE_ATTEMPTS: UpgradeAttemptsState = { version: 1, updatedAt: null, attempts: [] };
const EMPTY_LAST_SUCCESS: LastSuccessfulVersionState = {
  version: 1,
  updatedAt: null,
  environments: {},
};
const EMPTY_FAILURES: FailureRegistryState = { version: 1, updatedAt: null, failures: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeConfig(base: RadarConfig, override: unknown): RadarConfig {
  if (!isRecord(override)) {
    return base;
  }

  return {
    ...base,
    ...override,
    github: {
      ...base.github,
      ...(isRecord(override.github) ? override.github : {}),
    },
    reporting: {
      ...base.reporting,
      ...(isRecord(override.reporting) ? override.reporting : {}),
    },
    execution: {
      ...base.execution,
      ...(isRecord(override.execution) ? override.execution : {}),
    },
    scoreWeights: {
      ...base.scoreWeights,
      ...(isRecord(override.scoreWeights) ? override.scoreWeights : {}),
    },
    currentArchitecture: {
      ...base.currentArchitecture,
      ...(isRecord(override.currentArchitecture) ? override.currentArchitecture : {}),
    },
    watchRepos: Array.isArray(override.watch_repos)
      ? override.watch_repos.filter((item): item is string => typeof item === "string")
      : Array.isArray(override.watchRepos)
        ? override.watchRepos.filter((item): item is string => typeof item === "string")
        : base.watchRepos,
    watchTopics: Array.isArray(override.watch_topics)
      ? override.watch_topics.filter((item): item is string => typeof item === "string")
      : Array.isArray(override.watchTopics)
        ? override.watchTopics.filter((item): item is string => typeof item === "string")
        : base.watchTopics,
    approvedPaths: Array.isArray(override.approved_paths)
      ? override.approved_paths.filter((item): item is string => typeof item === "string")
      : Array.isArray(override.approvedPaths)
        ? override.approvedPaths.filter((item): item is string => typeof item === "string")
        : base.approvedPaths,
    allowedLicenses: Array.isArray(override.allowed_licenses)
      ? override.allowed_licenses.filter((item): item is string => typeof item === "string")
      : Array.isArray(override.allowedLicenses)
        ? override.allowedLicenses.filter((item): item is string => typeof item === "string")
        : base.allowedLicenses,
    topicsSearchLimit:
      typeof override.topics_search_limit === "number"
        ? override.topics_search_limit
        : typeof override.topicsSearchLimit === "number"
          ? override.topicsSearchLimit
          : base.topicsSearchLimit,
    scoreThreshold:
      typeof override.score_threshold === "number"
        ? override.score_threshold
        : typeof override.scoreThreshold === "number"
          ? override.scoreThreshold
          : base.scoreThreshold,
    minimumQualifyingSignals:
      typeof override.minimum_qualifying_signals === "number"
        ? override.minimum_qualifying_signals
        : typeof override.minimumQualifyingSignals === "number"
          ? override.minimumQualifyingSignals
          : base.minimumQualifyingSignals,
    compatibilityFloor:
      typeof override.compatibility_floor === "number"
        ? override.compatibility_floor
        : typeof override.compatibilityFloor === "number"
          ? override.compatibilityFloor
          : base.compatibilityFloor,
    performanceGainFloorPct:
      typeof override.performance_gain_floor_pct === "number"
        ? override.performance_gain_floor_pct
        : typeof override.performanceGainFloorPct === "number"
          ? override.performanceGainFloorPct
          : base.performanceGainFloorPct,
    costReductionFloorPct:
      typeof override.cost_reduction_floor_pct === "number"
        ? override.cost_reduction_floor_pct
        : typeof override.costReductionFloorPct === "number"
          ? override.costReductionFloorPct
          : base.costReductionFloorPct,
  };
}

export async function findWorkspaceRoot(startDir = process.cwd()): Promise<string> {
  let current = path.resolve(startDir);

  for (;;) {
    const configFile = path.join(current, CONFIG_RELATIVE_PATH);
    const agentsFile = path.join(current, "AGENTS.md");

    try {
      await readFile(configFile, "utf8");
      return current;
    } catch {
      // keep searching
    }

    try {
      await readFile(agentsFile, "utf8");
      return current;
    } catch {
      // keep searching
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

export async function loadConfig(paths: RuntimePaths): Promise<RadarConfig> {
  const raw = await readFile(paths.configFile, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const merged = mergeConfig(DEFAULT_CONFIG, parsed);

  merged.execution.autoPush = process.env.AI_RADAR_AUTO_PUSH === "1" || merged.execution.autoPush;
  merged.execution.autoCreatePr =
    process.env.AI_RADAR_AUTO_CREATE_PR === "1" || merged.execution.autoCreatePr;
  merged.execution.repository = process.env.AI_RADAR_REPOSITORY ?? merged.execution.repository;

  return merged;
}

export async function resolveRuntimePaths(workspaceRoot?: string): Promise<RuntimePaths> {
  const resolvedRoot = workspaceRoot ? path.resolve(workspaceRoot) : await findWorkspaceRoot();
  return {
    workspaceRoot: resolvedRoot,
    configFile: path.join(resolvedRoot, CONFIG_RELATIVE_PATH),
    reportsDir: path.join(resolvedRoot, "reports"),
    stateDir: path.join(resolvedRoot, "state"),
    fixturesDir: path.join(resolvedRoot, "fixtures", "ai-radar"),
  };
}

async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadState(paths: RuntimePaths): Promise<RadarStateBundle> {
  await mkdir(paths.stateDir, { recursive: true });

  return {
    seenRepos: await readJsonOrDefault(path.join(paths.stateDir, "seen_repos.json"), EMPTY_SEEN_REPOS),
    releaseHistory: await readJsonOrDefault(
      path.join(paths.stateDir, "release_history.json"),
      EMPTY_RELEASE_HISTORY,
    ),
    candidateHistory: await readJsonOrDefault(
      path.join(paths.stateDir, "candidate_history.json"),
      EMPTY_CANDIDATE_HISTORY,
    ),
    upgradeAttempts: await readJsonOrDefault(
      path.join(paths.stateDir, "upgrade_attempts.json"),
      EMPTY_UPGRADE_ATTEMPTS,
    ),
    lastSuccessfulVersion: await readJsonOrDefault(
      path.join(paths.stateDir, "last_successful_version.json"),
      EMPTY_LAST_SUCCESS,
    ),
    failureRegistry: await readJsonOrDefault(
      path.join(paths.stateDir, "failure_registry.json"),
      EMPTY_FAILURES,
    ),
  };
}

export async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function persistState(paths: RuntimePaths, state: RadarStateBundle): Promise<void> {
  await Promise.all([
    writeJsonFile(path.join(paths.stateDir, "seen_repos.json"), state.seenRepos),
    writeJsonFile(path.join(paths.stateDir, "release_history.json"), state.releaseHistory),
    writeJsonFile(path.join(paths.stateDir, "candidate_history.json"), state.candidateHistory),
    writeJsonFile(path.join(paths.stateDir, "upgrade_attempts.json"), state.upgradeAttempts),
    writeJsonFile(path.join(paths.stateDir, "last_successful_version.json"), state.lastSuccessfulVersion),
    writeJsonFile(path.join(paths.stateDir, "failure_registry.json"), state.failureRegistry),
  ]);
}

export async function loadRadarRuntime(options?: {
  workspaceRoot?: string;
  useFixtures?: boolean;
}): Promise<RadarRuntime> {
  const paths = await resolveRuntimePaths(options?.workspaceRoot);
  const config = await loadConfig(paths);
  const state = await loadState(paths);

  return {
    config,
    paths,
    state,
    now: new Date(),
    useFixtures: options?.useFixtures ?? process.env.AI_RADAR_USE_FIXTURES === "1",
  };
}
