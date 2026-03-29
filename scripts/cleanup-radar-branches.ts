import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRadarRuntime, writeJsonFile } from "../.openclaw/extensions/github-architecture-radar/config.js";

type BranchResponse = {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
};

type PullResponse = {
  number: number;
  state: string;
  html_url: string;
  head: {
    ref: string;
  };
};

type CommitResponse = {
  commit: {
    author: {
      date: string;
    };
  };
};

type CleanupBranchRecord = {
  name: string;
  sha: string;
  committedAt: string;
  reason?: string;
  pullRequestUrl?: string;
};

const DEFAULT_KEEP_COUNT = 2;

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseKeepCount(value: string | undefined): number {
  if (!value?.trim()) {
    return DEFAULT_KEEP_COUNT;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_KEEP_COUNT;
  }
  return Math.floor(parsed);
}

function buildHeaders(token: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    "user-agent": "openclaw-ai-radar-cleanup",
  };
}

async function fetchJson<T>(url: string, headers: HeadersInit, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${text || url}`);
  }

  return (await response.json()) as T;
}

async function deleteBranch(url: string, headers: HeadersInit): Promise<void> {
  const response = await fetch(url, {
    method: "DELETE",
    headers,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Delete branch failed: ${response.status} ${response.statusText}: ${text || url}`);
  }
}

function cleanupMarkdown(payload: {
  executedAt: string;
  repository: string;
  branchPrefix: string;
  dryRun: boolean;
  keepCount: number;
  scannedBranches: number;
  preservedOpenPrBranches: CleanupBranchRecord[];
  keptRecentBranches: CleanupBranchRecord[];
  deletedBranches: CleanupBranchRecord[];
}): string {
  const lines: string[] = [
    "# AI Radar Branch Cleanup",
    "",
    "## Summary",
    `- Executed at: ${payload.executedAt}`,
    `- Repository: ${payload.repository}`,
    `- Branch prefix: ${payload.branchPrefix}`,
    `- Dry run: ${payload.dryRun ? "yes" : "no"}`,
    `- Scanned upgrade branches: ${payload.scannedBranches}`,
    `- Keep newest closed branches: ${payload.keepCount}`,
    `- Preserved for open PRs: ${payload.preservedOpenPrBranches.length}`,
    `- Deleted stale branches: ${payload.deletedBranches.length}`,
    "",
    "## Preserved For Open PRs",
  ];

  if (payload.preservedOpenPrBranches.length === 0) {
    lines.push("- None");
  } else {
    for (const branch of payload.preservedOpenPrBranches) {
      lines.push(`- ${branch.name} | ${branch.pullRequestUrl ?? "open PR"}`);
    }
  }

  lines.push("", "## Kept Recent Branches");
  if (payload.keptRecentBranches.length === 0) {
    lines.push("- None");
  } else {
    for (const branch of payload.keptRecentBranches) {
      lines.push(`- ${branch.name} | committedAt=${branch.committedAt}`);
    }
  }

  lines.push("", "## Deleted Branches");
  if (payload.deletedBranches.length === 0) {
    lines.push("- None");
  } else {
    for (const branch of payload.deletedBranches) {
      lines.push(`- ${branch.name} | committedAt=${branch.committedAt}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const runtime = await loadRadarRuntime({ workspaceRoot: path.resolve(process.cwd()) });
  const token = process.env[runtime.config.github.tokenEnv];
  const repository = process.env.GITHUB_REPOSITORY ?? runtime.config.execution.repository;

  if (!token) {
    throw new Error(`Missing GitHub token in ${runtime.config.github.tokenEnv}.`);
  }

  if (!repository) {
    throw new Error("Missing repository configuration for branch cleanup.");
  }

  const dryRun = hasFlag("--dry-run") || process.env.AI_RADAR_BRANCH_CLEANUP_DRY_RUN === "1";
  const keepCount = parseKeepCount(process.env.AI_RADAR_BRANCH_RETENTION_COUNT);
  const branchPrefix = `${runtime.config.execution.branchPrefix}/`;
  const headers = buildHeaders(token);
  const apiBase = runtime.config.github.apiBaseUrl;

  const [branches, pulls] = await Promise.all([
    fetchJson<BranchResponse[]>(
      `${apiBase}/repos/${repository}/branches?per_page=100`,
      headers,
    ),
    fetchJson<PullResponse[]>(
      `${apiBase}/repos/${repository}/pulls?state=open&per_page=100`,
      headers,
    ),
  ]);

  const upgradeBranches = branches.filter((branch) => branch.name.startsWith(branchPrefix));
  const openPullsByBranch = new Map(
    pulls
      .filter((pull) => pull.head.ref.startsWith(branchPrefix))
      .map((pull) => [pull.head.ref, pull.html_url]),
  );

  const branchDetails = await Promise.all(
    upgradeBranches.map(async (branch) => {
      const commit = await fetchJson<CommitResponse>(branch.commit.url, headers);
      return {
        name: branch.name,
        sha: branch.commit.sha,
        committedAt: commit.commit.author.date,
      };
    }),
  );

  const preservedOpenPrBranches = branchDetails
    .filter((branch) => openPullsByBranch.has(branch.name))
    .map((branch) => ({
      ...branch,
      reason: "open-pr",
      pullRequestUrl: openPullsByBranch.get(branch.name),
    }));

  const closableBranches = branchDetails
    .filter((branch) => !openPullsByBranch.has(branch.name))
    .sort((left, right) => right.committedAt.localeCompare(left.committedAt));

  const keptRecentBranches = closableBranches
    .slice(0, keepCount)
    .map((branch) => ({ ...branch, reason: "recent-retention" }));
  const deletedCandidates = closableBranches.slice(keepCount);

  const deletedBranches: CleanupBranchRecord[] = [];
  for (const branch of deletedCandidates) {
    if (!dryRun) {
      await deleteBranch(`${apiBase}/repos/${repository}/git/refs/heads/${branch.name}`, headers);
    }
    deletedBranches.push({ ...branch, reason: dryRun ? "dry-run" : "deleted" });
  }

  const payload = {
    executedAt: new Date().toISOString(),
    repository,
    branchPrefix,
    dryRun,
    keepCount,
    scannedBranches: upgradeBranches.length,
    preservedOpenPrBranches,
    keptRecentBranches,
    deletedBranches,
  };

  const reportsDir = path.join(runtime.paths.reportsDir, "maintenance");
  await mkdir(reportsDir, { recursive: true });
  await writeJsonFile(path.join(runtime.paths.stateDir, "branch_cleanup.json"), payload);
  await writeJsonFile(path.join(reportsDir, "latest-branch-cleanup.json"), payload);
  await writeFile(path.join(reportsDir, "latest-branch-cleanup.md"), cleanupMarkdown(payload), "utf8");

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
