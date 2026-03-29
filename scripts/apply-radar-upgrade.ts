import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FeedSourceConfig = {
  label: string;
  url: string;
  tags: string[];
};

type CandidatePayload = {
  repo: {
    fullName: string;
    topics: string[];
    description?: string;
    latestRelease?: {
      tagName?: string;
      publishedAt?: string;
    } | null;
  };
  score?: {
    finalUpgradeScore?: number;
    summary?: string[];
  };
};

type RadarConfigFile = {
  watch_repos?: string[];
  watch_topics?: string[];
  approved_paths?: string[];
  execution?: {
    autoValidate?: boolean;
    autoApplyUpgrade?: boolean;
    autoDeploy?: boolean;
    autoCreateBranch?: boolean;
    autoCommit?: boolean;
    autoPush?: boolean;
    autoCreatePr?: boolean;
    deployTarget?: string;
  };
};

type RuntimeArchitectureProfile = {
  version: 1;
  updatedAt: string | null;
  candidate: {
    repo: string;
    releaseTag: string;
    changeType: string;
    appliedAt: string;
    reportPath: string;
    score: number | null;
  };
  notes: string[];
  runtime: {
    provider: string;
    limit: number;
    requestTimeoutMs: number;
    xBrowserEnabled: boolean;
    xBrowserWaitMs: number;
    xSearchMode: "top" | "live";
    xSearchQuery: string;
    xFallbackFeeds: FeedSourceConfig[];
    aiArticleFeeds: FeedSourceConfig[];
    hnStoryType: "topstories" | "beststories" | "newstories";
  };
};

const DEFAULT_QUERY =
  '(OpenAI OR Anthropic OR Claude OR Gemini OR DeepSeek OR Grok OR LLM OR "AI agents" OR "AI model") min_faves:20 lang:en -is:retweet -is:reply';
const DEFAULT_PROFILE: RuntimeArchitectureProfile = {
  version: 1,
  updatedAt: null,
  candidate: {
    repo: "unknown/unknown",
    releaseTag: "unknown",
    changeType: "dependency-upgrade",
    appliedAt: "",
    reportPath: "",
    score: null,
  },
  notes: [],
  runtime: {
    provider: "aggregate",
    limit: 12,
    requestTimeoutMs: 20_000,
    xBrowserEnabled: true,
    xBrowserWaitMs: 8_000,
    xSearchMode: "top",
    xSearchQuery: DEFAULT_QUERY,
    xFallbackFeeds: [],
    aiArticleFeeds: [
      {
        label: "openai-news",
        url: "https://openai.com/news/rss.xml",
        tags: ["AI", "Article", "OpenAI"],
      },
      {
        label: "deepmind-blog",
        url: "https://deepmind.google/blog/rss.xml",
        tags: ["AI", "Article", "DeepMind"],
      },
      {
        label: "microsoft-research-blog",
        url: "https://www.microsoft.com/en-us/research/blog/feed/",
        tags: ["AI", "Article", "Research", "Microsoft Research"],
      },
    ],
    hnStoryType: "topstories",
  },
};

function toRepoPath(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  return (relative || ".").replace(/\\/g, "/");
}

function resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.join(workspaceRoot, targetPath);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueFeeds(feeds: FeedSourceConfig[]): FeedSourceConfig[] {
  const deduped = new Map<string, FeedSourceConfig>();

  for (const feed of feeds) {
    if (!feed.label || !feed.url) continue;
    deduped.set(feed.label, {
      label: feed.label,
      url: feed.url,
      tags: uniqueStrings(feed.tags ?? []),
    });
  }

  return [...deduped.values()];
}

function inferChangeType(topics: string[]): string {
  const lowered = topics.map((topic) => topic.toLowerCase());

  if (lowered.some((topic) => topic.includes("inference") || topic.includes("serving"))) {
    return "inference-framework-replacement";
  }
  if (lowered.some((topic) => topic.includes("mcp") || topic.includes("browser") || topic.includes("tool"))) {
    return "tool-plugin-integration";
  }
  if (lowered.some((topic) => topic.includes("workflow") || topic.includes("automation"))) {
    return "workflow-optimization";
  }
  if (lowered.some((topic) => topic.includes("agent"))) {
    return "provider-replacement";
  }

  return "dependency-upgrade";
}

function releaseFeedForRepo(repoFullName: string, topics: string[]): FeedSourceConfig {
  return {
    label: `github-release-${repoFullName.replace(/[\\/]/g, "-").toLowerCase()}`,
    url: `https://github.com/${repoFullName}/releases.atom`,
    tags: uniqueStrings(["AI", "GitHub", "Release", ...topics.slice(0, 4)]),
  };
}

function buildCandidateQuery(repoFullName: string, topics: string[], changeType: string): string {
  const [owner, name] = repoFullName.split("/");
  const topicTerms = topics
    .slice(0, 4)
    .map((topic) => `"${topic.replace(/"/g, "")}"`);
  const repoTerms = [owner, name]
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, "")}"`);

  const changeTerms =
    changeType === "inference-framework-replacement"
      ? ['"model serving"', '"llm inference"', '"throughput"', '"latency"']
      : changeType === "tool-plugin-integration"
        ? ['"browser automation"', '"tool use"', '"agent workflow"']
        : changeType === "workflow-optimization"
          ? ['"workflow automation"', '"agent orchestration"', '"evaluation pipeline"']
          : ['"AI agents"', '"LLM"', '"AI model"'];

  return `(${uniqueStrings([...repoTerms, ...topicTerms, ...changeTerms]).join(" OR ")}) min_faves:20 lang:en -is:retweet -is:reply`;
}

function buildRuntimeProfile(
  existing: RuntimeArchitectureProfile,
  candidate: CandidatePayload,
  reportPath: string,
): RuntimeArchitectureProfile {
  const repoFullName = candidate.repo.fullName;
  const topics = uniqueStrings(candidate.repo.topics ?? []);
  const changeType = inferChangeType(topics);
  const now = new Date().toISOString();
  const releaseTag = process.env.AI_RADAR_CANDIDATE_RELEASE ?? candidate.repo.latestRelease?.tagName ?? "unknown";
  const releaseFeed = releaseFeedForRepo(repoFullName, topics);

  const runtime = {
    ...existing.runtime,
    provider: "aggregate",
    limit:
      changeType === "inference-framework-replacement" || changeType === "workflow-optimization"
        ? 18
        : 15,
    requestTimeoutMs:
      changeType === "inference-framework-replacement"
        ? 30_000
        : changeType === "tool-plugin-integration"
          ? 25_000
          : 20_000,
    xBrowserEnabled: true,
    xBrowserWaitMs:
      changeType === "tool-plugin-integration" || changeType === "workflow-optimization" ? 12_000 : 9_000,
    xSearchMode:
      changeType === "tool-plugin-integration" || changeType === "provider-replacement" ? "live" : "top",
    xSearchQuery: buildCandidateQuery(repoFullName, topics, changeType),
    xFallbackFeeds: uniqueFeeds(existing.runtime.xFallbackFeeds),
    aiArticleFeeds: uniqueFeeds([releaseFeed, ...existing.runtime.aiArticleFeeds]),
    hnStoryType:
      changeType === "inference-framework-replacement" || changeType === "workflow-optimization"
        ? "beststories"
        : "topstories",
  } satisfies RuntimeArchitectureProfile["runtime"];

  return {
    version: 1,
    updatedAt: now,
    candidate: {
      repo: repoFullName,
      releaseTag,
      changeType,
      appliedAt: now,
      reportPath,
      score: typeof candidate.score?.finalUpgradeScore === "number" ? candidate.score.finalUpgradeScore : null,
    },
    notes: uniqueStrings([
      `Applied candidate ${repoFullName}@${releaseTag}`,
      `Change type: ${changeType}`,
      ...(candidate.score?.summary ?? []),
    ]),
    runtime,
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

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd());
  const configPath = path.join(workspaceRoot, "config", "ai-upgrade-radar.json");
  const runtimeProfilePath = path.join(workspaceRoot, "config", "runtime-architecture.json");
  const statePath = path.join(workspaceRoot, "state", "applied_upgrade.json");
  const reportPathInput = process.env.AI_RADAR_REPORT_PATH ?? "";
  const reportPathAbsolute = reportPathInput ? resolveWorkspacePath(workspaceRoot, reportPathInput) : "";
  const reportPath = reportPathAbsolute ? toRepoPath(workspaceRoot, reportPathAbsolute) : "";
  const reportDir = reportPathAbsolute
    ? path.dirname(reportPathAbsolute)
    : path.join(workspaceRoot, "reports", "upgrades", "unknown");
  const runtimeProfilePathForState = toRepoPath(workspaceRoot, runtimeProfilePath);
  const candidatePath = path.join(reportDir, "candidate.json");

  const candidate = await readJsonOrDefault<CandidatePayload>(candidatePath, {
    repo: {
      fullName: process.env.AI_RADAR_CANDIDATE_REPO ?? "unknown/unknown",
      topics: [],
      latestRelease: {
        tagName: process.env.AI_RADAR_CANDIDATE_RELEASE ?? "unknown",
      },
    },
  });

  const config = await readJsonOrDefault<RadarConfigFile>(configPath, {});
  const existingProfile = await readJsonOrDefault<RuntimeArchitectureProfile>(runtimeProfilePath, DEFAULT_PROFILE);
  const nextProfile = buildRuntimeProfile(existingProfile, candidate, reportPath);

  config.watch_repos = uniqueStrings([candidate.repo.fullName, ...(config.watch_repos ?? [])]);
  config.watch_topics = uniqueStrings([...(candidate.repo.topics ?? []).slice(0, 4), ...(config.watch_topics ?? [])]);
  config.approved_paths = uniqueStrings([...(config.approved_paths ?? []), "output"]);
  config.execution = {
    ...(config.execution ?? {}),
    autoValidate: true,
    autoApplyUpgrade: true,
    autoDeploy: true,
    autoCreateBranch: true,
    autoCommit: true,
    autoPush: true,
    autoCreatePr: true,
    deployTarget:
      config.execution?.deployTarget === "canary" || config.execution?.deployTarget === "staging"
        ? config.execution.deployTarget
        : "staging",
  };

  const statePayload = {
    version: 1,
    appliedAt: nextProfile.updatedAt,
    repo: nextProfile.candidate.repo,
    releaseTag: nextProfile.candidate.releaseTag,
    changeType: nextProfile.candidate.changeType,
    reportPath,
    runtimeProfilePath: runtimeProfilePathForState,
  };

  const reportPayload = {
    appliedAt: nextProfile.updatedAt,
    candidate: nextProfile.candidate,
    runtime: nextProfile.runtime,
    notes: nextProfile.notes,
  };

  await writeJson(configPath, config);
  await writeJson(runtimeProfilePath, nextProfile);
  await writeJson(statePath, statePayload);
  await writeJson(path.join(reportDir, "applied-upgrade.json"), reportPayload);
  await writeFile(
    path.join(reportDir, "applied-upgrade.md"),
    [
      "# Applied Upgrade",
      "",
      `- Repository: ${nextProfile.candidate.repo}`,
      `- Release: ${nextProfile.candidate.releaseTag}`,
      `- Change type: ${nextProfile.candidate.changeType}`,
      `- Applied at: ${nextProfile.candidate.appliedAt}`,
      "",
      "## Runtime Changes",
      `- provider: ${nextProfile.runtime.provider}`,
      `- limit: ${nextProfile.runtime.limit}`,
      `- requestTimeoutMs: ${nextProfile.runtime.requestTimeoutMs}`,
      `- xBrowserEnabled: ${nextProfile.runtime.xBrowserEnabled}`,
      `- xSearchMode: ${nextProfile.runtime.xSearchMode}`,
      `- hnStoryType: ${nextProfile.runtime.hnStoryType}`,
    ].join("\n"),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        applied: true,
        candidate: nextProfile.candidate,
        runtimeProfilePath: runtimeProfilePathForState,
        reportDir: toRepoPath(workspaceRoot, reportDir),
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
