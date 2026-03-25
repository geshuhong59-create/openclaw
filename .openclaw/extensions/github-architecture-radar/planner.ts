import { ChangeType, RadarConfig, RiskLevel, ScoredCandidate, UpgradePlan } from "./types.js";

function classifyChangeType(candidate: ScoredCandidate): ChangeType {
  const topics = candidate.repo.topics.map((topic) => topic.toLowerCase());

  if (topics.some((topic) => topic.includes("inference") || topic.includes("serving"))) {
    return "inference-framework-replacement";
  }
  if (topics.some((topic) => topic.includes("mcp") || topic.includes("browser") || topic.includes("tool"))) {
    return "tool-plugin-integration";
  }
  if (topics.some((topic) => topic.includes("workflow") || topic.includes("automation"))) {
    return "workflow-optimization";
  }
  if (topics.some((topic) => topic.includes("agent"))) {
    return "provider-replacement";
  }
  return "dependency-upgrade";
}

function planFiles(changeType: ChangeType): string[] {
  switch (changeType) {
    case "dependency-upgrade":
      return ["package.json", "package-lock.json", ".github/workflows/ai-radar-pr-validate.yml"];
    case "provider-replacement":
      return [
        "config/ai-upgrade-radar.json",
        ".openclaw/extensions/github-architecture-radar/index.ts",
        "scripts/test-upgrade.sh",
      ];
    case "tool-plugin-integration":
      return [
        ".openclaw/extensions/github-architecture-radar/index.ts",
        "AGENTS.md",
        ".github/workflows/ai-radar-daily.yml",
      ];
    case "workflow-optimization":
      return [
        ".github/workflows/ai-radar-daily.yml",
        ".github/workflows/ai-radar-pr-validate.yml",
        "scripts/run-radar.ts",
      ];
    case "inference-framework-replacement":
      return [
        "config/ai-upgrade-radar.json",
        "scripts/benchmark.sh",
        "scripts/rollback-check.sh",
        ".github/workflows/deploy-staging.yml",
      ];
  }
}

function riskLevelForChange(changeType: ChangeType): RiskLevel {
  switch (changeType) {
    case "dependency-upgrade":
    case "workflow-optimization":
      return "low";
    case "tool-plugin-integration":
    case "provider-replacement":
      return "medium";
    case "inference-framework-replacement":
      return "high";
  }
}

function ensureApprovedPaths(filesToChange: string[], config: RadarConfig): string[] {
  return filesToChange.filter((filePath) =>
    config.approvedPaths.some((approvedPath) => filePath.startsWith(approvedPath) || filePath === approvedPath),
  );
}

export function createUpgradePlan(candidate: ScoredCandidate, config: RadarConfig): UpgradePlan {
  const changeType = classifyChangeType(candidate);
  const plannedFiles = planFiles(changeType);
  const filesToChange = ensureApprovedPaths(plannedFiles, config);
  const riskLevel = riskLevelForChange(changeType);

  return {
    target: candidate.repo.fullName,
    changeType,
    riskLevel,
    filesToChange,
    summary: `Evaluate ${candidate.repo.fullName} as a ${changeType} candidate on an isolated branch with staging-only validation.`,
    rollbackPlan: [
      "Reset the experiment branch to the last successful staging commit.",
      "Restore the candidate version recorded in state/last_successful_version.json.",
      "Re-run smoke, regression, and rollback simulation before reopening the PR.",
    ],
    validationChecklist: [
      "Smoke test passes on the isolated branch.",
      "Integration test passes against the staging profile.",
      "Regression suite shows no critical diff.",
      "Benchmark smoke confirms the projected improvement is directionally true.",
      "Rollback simulation restores the last successful staging version.",
    ],
    humanEscalations: [
      "Escalate if production deployment is requested.",
      "Escalate if the release notes imply a breaking API migration.",
      "Escalate if license status is unknown or incompatible.",
      "Escalate if benchmark outcomes are ambiguous.",
    ],
  };
}

export function renderUpgradePlanMarkdown(candidate: ScoredCandidate, plan: UpgradePlan): string {
  const signals = Object.entries(candidate.score.qualifyingSignals)
    .map(([label, passed]) => `- ${label}: ${passed ? "pass" : "fail"}`)
    .join("\n");

  return `# Upgrade Plan\n\n## Candidate\n- Repository: ${candidate.repo.fullName}\n- Final upgrade score: ${candidate.score.finalUpgradeScore}\n- Change type: ${plan.changeType}\n- Risk: ${plan.riskLevel}\n\n## Planned Changes\n${plan.filesToChange.map((file) => `- ${file}`).join("\n")}\n\n## Qualifying Signals\n${signals}\n\n## Validation Checklist\n${plan.validationChecklist.map((item) => `- ${item}`).join("\n")}\n\n## Rollback Plan\n${plan.rollbackPlan.map((item) => `- ${item}`).join("\n")}\n\n## Human Escalation Triggers\n${plan.humanEscalations.map((item) => `- ${item}`).join("\n")}\n`;
}
