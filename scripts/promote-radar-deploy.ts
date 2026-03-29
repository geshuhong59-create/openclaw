import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

async function runGit(args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, env: buildGitEnv() });
  return `${result.stdout}`.trim();
}

async function remoteRefExists(cwd: string, remote: string, branch: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--verify", `refs/remotes/${remote}/${branch}`], cwd);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd());
  const remote = process.env.AI_RADAR_GIT_REMOTE ?? "origin";
  const deployTarget = process.env.AI_RADAR_DEPLOY_TARGET ?? "staging";
  const branchName = (await runGit(["branch", "--show-current"], workspaceRoot)) || process.env.AI_RADAR_BRANCH_NAME || "HEAD";

  try {
    await runGit(["fetch", remote, deployTarget], workspaceRoot);
  } catch {
    // The target branch may not exist yet; creating it on push is acceptable.
  }

  if (await remoteRefExists(workspaceRoot, remote, deployTarget)) {
    await runGit(["merge-base", "--is-ancestor", `refs/remotes/${remote}/${deployTarget}`, "HEAD"], workspaceRoot);
  }

  await runGit(["push", remote, `HEAD:${deployTarget}`], workspaceRoot);
  const commitSha = await runGit(["rev-parse", "HEAD"], workspaceRoot);

  const payload = {
    promoted: true,
    promotedAt: new Date().toISOString(),
    branchName,
    deployTarget,
    commitSha,
    remote,
  };

  await writeJson(path.join(workspaceRoot, "state", "last_branch_promotion.json"), payload);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
