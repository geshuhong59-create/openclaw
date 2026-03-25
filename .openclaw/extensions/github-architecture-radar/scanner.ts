import { GitHubApiClient } from "./github-api.js";
import { RadarRuntime, RepoSnapshot } from "./types.js";

function mergeSources(
  repo: RepoSnapshot,
  incoming: Array<{ kind: "watch_repo" | "topic"; value: string }>,
): RepoSnapshot {
  const deduped = [...repo.source];

  for (const source of incoming) {
    if (!deduped.some((item) => item.kind === source.kind && item.value === source.value)) {
      deduped.push(source);
    }
  }

  return { ...repo, source: deduped };
}

export async function scanRepositories(runtime: RadarRuntime): Promise<RepoSnapshot[]> {
  const client = new GitHubApiClient(runtime.config, runtime.paths, runtime.useFixtures);
  const collected = new Map<string, RepoSnapshot>();

  for (const fullName of runtime.config.watchRepos) {
    const repo = await client.getRepository(fullName, [{ kind: "watch_repo", value: fullName }]);
    collected.set(repo.fullName, repo);
  }

  for (const topic of runtime.config.watchTopics) {
    const repos = await client.searchTopicRepositories(topic, runtime.config.topicsSearchLimit);
    for (const repo of repos) {
      const existing = collected.get(repo.fullName);
      collected.set(
        repo.fullName,
        existing ? mergeSources(existing, [{ kind: "topic", value: topic }]) : repo,
      );
    }
  }

  return [...collected.values()].sort((left, right) => right.stars - left.stars);
}
