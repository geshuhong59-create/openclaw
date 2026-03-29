import { readFile } from "node:fs/promises";
import path from "node:path";
import { LatestRelease, RadarConfig, RepoSnapshot, RuntimePaths } from "./types.js";

type SearchResponse = {
  items?: Array<{
    full_name: string;
    html_url: string;
    description: string | null;
    topics?: string[];
    stargazers_count: number;
    forks_count: number;
    default_branch: string;
    updated_at: string;
    pushed_at: string;
    license?: { spdx_id?: string | null } | null;
  }>;
};

type RepoResponse = {
  full_name: string;
  html_url: string;
  description: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  license?: { spdx_id?: string | null } | null;
};

type CommitResponse = Array<{ sha: string }>;

type ReadmeResponse = {
  content?: string;
  encoding?: string;
};

type PullRequestResponse = {
  html_url: string;
};

type FixtureSnapshot = {
  generatedAt: string;
  repos: Array<
    RepoSnapshot & {
      readme: string;
    }
  >;
};

const MAX_RETRIES = 4;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRY_WAIT_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number, bodyText: string, retryAfter: string | null): boolean {
  if (status >= 500 || status === 429) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const normalized = bodyText.toLowerCase();
  return (
    retryAfter !== null ||
    normalized.includes("secondary rate limit") ||
    normalized.includes("rate limit exceeded") ||
    normalized.includes("abuse detection")
  );
}

function buildHeaders(config: RadarConfig): HeadersInit {
  const token = process.env[config.github.tokenEnv];
  const headers: HeadersInit = {
    accept: "application/vnd.github+json",
    "x-github-api-version": config.github.restVersion,
    "user-agent": "openclaw-ai-upgrade-radar",
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchJson<T>(url: string, config: RadarConfig, init?: RequestInit): Promise<T> {
  let attempt = 0;

  for (;;) {
    attempt += 1;
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        ...buildHeaders(config),
        ...(init?.headers ?? {}),
      },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const text = await response.text();
    const retryAfter = response.headers.get("retry-after");
    const resetAt = response.headers.get("x-ratelimit-reset");

    if (response.status === 404) {
      throw new Error(`GitHub resource not found: ${url}`);
    }

    const isRetryable = shouldRetry(response.status, text, retryAfter);

    if (!isRetryable || attempt >= MAX_RETRIES) {
      throw new Error(`GitHub API ${response.status} ${response.statusText}: ${text || url}`);
    }

    let waitMs = 1000 * attempt;
    if (retryAfter) {
      waitMs = Number(retryAfter) * 1000;
    } else if (resetAt) {
      waitMs = Math.max(Number(resetAt) * 1000 - Date.now(), waitMs);
    }
    waitMs = Math.min(waitMs, MAX_RETRY_WAIT_MS);
    console.warn(
      `[ai-radar][github-api] retrying ${response.status} ${response.statusText} for ${url} in ${waitMs}ms (attempt ${attempt}/${MAX_RETRIES})`,
    );
    await sleep(waitMs);
  }
}

async function fetchOptionalJson<T>(url: string, config: RadarConfig): Promise<T | null> {
  try {
    return await fetchJson<T>(url, config);
  } catch (error) {
    if (String(error).includes("not found")) {
      return null;
    }
    throw error;
  }
}

function decodeReadmeContent(payload: ReadmeResponse | null): string {
  if (!payload?.content) {
    return "";
  }
  if (payload.encoding === "base64") {
    return Buffer.from(payload.content, "base64").toString("utf8");
  }
  return payload.content;
}

function toRepoSnapshot(
  payload: RepoResponse,
  source: Array<{ kind: "watch_repo" | "topic"; value: string }>,
  readme: string,
  latestRelease: LatestRelease | null,
  recentCommitCount30d: number,
): RepoSnapshot {
  return {
    fullName: payload.full_name,
    url: payload.html_url,
    description: payload.description ?? "",
    topics: payload.topics ?? [],
    stars: payload.stargazers_count,
    forks: payload.forks_count,
    defaultBranch: payload.default_branch,
    updatedAt: payload.updated_at,
    pushedAt: payload.pushed_at,
    license: payload.license?.spdx_id ?? null,
    readme,
    recentCommitCount30d,
    latestRelease,
    source,
  };
}

async function loadFixtureSnapshot(paths: RuntimePaths): Promise<FixtureSnapshot> {
  const filePath = path.join(paths.fixturesDir, "sample-scan.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as FixtureSnapshot;
}

export class GitHubApiClient {
  constructor(
    private readonly config: RadarConfig,
    private readonly paths: RuntimePaths,
    private readonly useFixtures: boolean,
  ) {}

  async searchTopicRepositories(topic: string, limit: number): Promise<RepoSnapshot[]> {
    if (this.useFixtures) {
      const fixtures = await loadFixtureSnapshot(this.paths);
      return fixtures.repos
        .filter((repo) => repo.topics.includes(topic))
        .slice(0, limit)
        .map((repo) => ({
          ...repo,
          source: [{ kind: "topic", value: topic }],
        }));
    }

    const q = encodeURIComponent(`topic:${topic} archived:false fork:false`);
    const url = `${this.config.github.apiBaseUrl}/search/repositories?q=${q}&sort=updated&order=desc&per_page=${limit}`;
    const response = await fetchJson<SearchResponse>(url, this.config);

    const repos = response.items ?? [];
    const detailed = await Promise.all(
      repos.map(async (repo) => {
        const fullName = repo.full_name;
        return this.getRepository(fullName, [{ kind: "topic", value: topic }]);
      }),
    );

    return detailed;
  }

  async getRepository(
    fullName: string,
    source: Array<{ kind: "watch_repo" | "topic"; value: string }> = [{ kind: "watch_repo", value: fullName }],
  ): Promise<RepoSnapshot> {
    if (this.useFixtures) {
      const fixtures = await loadFixtureSnapshot(this.paths);
      const match = fixtures.repos.find((repo) => repo.fullName === fullName);
      if (!match) {
        throw new Error(`Fixture repository not found: ${fullName}`);
      }
      return { ...match, source };
    }

    const repoUrl = `${this.config.github.apiBaseUrl}/repos/${fullName}`;
    const repo = await fetchJson<RepoResponse>(repoUrl, this.config);
    const [latestRelease, readme, recentCommitCount30d] = await Promise.all([
      this.getLatestRelease(fullName),
      this.getReadme(fullName),
      this.getRecentCommitCount(fullName),
    ]);

    return toRepoSnapshot(repo, source, readme, latestRelease, recentCommitCount30d);
  }

  async getLatestRelease(fullName: string): Promise<LatestRelease | null> {
    if (this.useFixtures) {
      const fixtures = await loadFixtureSnapshot(this.paths);
      return fixtures.repos.find((repo) => repo.fullName === fullName)?.latestRelease ?? null;
    }

    const url = `${this.config.github.apiBaseUrl}/repos/${fullName}/releases/latest`;
    const response = await fetchOptionalJson<{
      tag_name: string;
      name: string;
      html_url: string;
      published_at: string;
      prerelease: boolean;
      draft: boolean;
      body?: string;
    }>(url, this.config);

    if (!response) {
      return null;
    }

    return {
      tagName: response.tag_name,
      name: response.name,
      htmlUrl: response.html_url,
      publishedAt: response.published_at,
      prerelease: response.prerelease,
      draft: response.draft,
      body: response.body,
    };
  }

  async getReadme(fullName: string): Promise<string> {
    if (this.useFixtures) {
      const fixtures = await loadFixtureSnapshot(this.paths);
      return fixtures.repos.find((repo) => repo.fullName === fullName)?.readme ?? "";
    }

    const url = `${this.config.github.apiBaseUrl}/repos/${fullName}/readme`;
    const payload = await fetchOptionalJson<ReadmeResponse>(url, this.config);
    return decodeReadmeContent(payload);
  }

  async getRecentCommitCount(fullName: string): Promise<number> {
    if (this.useFixtures) {
      const fixtures = await loadFixtureSnapshot(this.paths);
      return fixtures.repos.find((repo) => repo.fullName === fullName)?.recentCommitCount30d ?? 0;
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const url = `${this.config.github.apiBaseUrl}/repos/${fullName}/commits?since=${encodeURIComponent(since)}&per_page=100`;
    const commits = await fetchOptionalJson<CommitResponse>(url, this.config);
    return commits?.length ?? 0;
  }

  async createPullRequest(input: {
    repository: string;
    head: string;
    base: string;
    title: string;
    body: string;
  }): Promise<string> {
    const url = `${this.config.github.apiBaseUrl}/repos/${input.repository}/pulls`;
    const payload = await fetchJson<PullRequestResponse>(url, this.config, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        head: input.head,
        base: input.base,
        title: input.title,
        body: input.body,
      }),
    });
    return payload.html_url;
  }
}
