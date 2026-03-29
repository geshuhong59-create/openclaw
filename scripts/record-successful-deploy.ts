import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LastSuccessfulVersionState = {
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

const EMPTY_STATE: LastSuccessfulVersionState = {
  version: 1,
  updatedAt: null,
  environments: {},
};

function normalizeState(payload: unknown): LastSuccessfulVersionState {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ...EMPTY_STATE, environments: {} };
  }

  const record = payload as Record<string, unknown>;
  const environments =
    record.environments && typeof record.environments === "object" && !Array.isArray(record.environments)
      ? { ...(record.environments as LastSuccessfulVersionState["environments"]) }
      : {};

  const legacyVersion = typeof record.version === "string" ? record.version : undefined;
  const legacyCandidateKey = typeof record.candidateKey === "string" ? record.candidateKey : undefined;
  const legacyRecordedAt = typeof record.recordedAt === "string" ? record.recordedAt : undefined;
  const legacyBranchName = typeof record.branchName === "string" ? record.branchName : undefined;

  if (
    Object.keys(environments).length === 0 &&
    legacyVersion &&
    legacyCandidateKey &&
    legacyRecordedAt &&
    legacyBranchName
  ) {
    environments.staging = {
      candidateKey: legacyCandidateKey,
      version: legacyVersion,
      recordedAt: legacyRecordedAt,
      branchName: legacyBranchName,
    };
  }

  return {
    version: 1,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    environments,
  };
}

async function readState(filePath: string): Promise<LastSuccessfulVersionState> {
  try {
    const raw = await readFile(filePath, "utf8");
    return normalizeState(JSON.parse(raw) as unknown);
  } catch {
    return { ...EMPTY_STATE, environments: {} };
  }
}

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd());
  const stateDir = path.join(workspaceRoot, "state");
  const stateFile = path.join(stateDir, "last_successful_version.json");
  const deployTarget = (process.env.AI_RADAR_DEPLOY_TARGET ?? "staging") as "staging" | "canary";
  const now = new Date().toISOString();

  if (deployTarget !== "staging" && deployTarget !== "canary") {
    throw new Error(`Unsupported deploy target: ${deployTarget}`);
  }

  const state = await readState(stateFile);
  state.updatedAt = now;
  state.environments[deployTarget] = {
    candidateKey: process.env.AI_RADAR_CANDIDATE_KEY ?? "unknown",
    version: process.env.AI_RADAR_CANDIDATE_RELEASE ?? "unknown",
    recordedAt: now,
    branchName: process.env.AI_RADAR_BRANCH_NAME ?? "unknown",
  };

  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ updated: true, target: deployTarget, stateFile }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
