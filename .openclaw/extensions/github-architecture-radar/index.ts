import { loadRadarRuntime } from "./config.js";
import { createUpgradePlan } from "./planner.js";
import { renderDailyReport, runDailyRadarCycle } from "./reporter.js";
import { scoreCandidates } from "./scorer.js";
import { scanRepositories } from "./scanner.js";

type ToolContext = {
  workspaceDir?: string;
};

type PluginApi = {
  logger?: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
  registerTool(
    factory: (ctx: ToolContext) => {
      name: string;
      label: string;
      description: string;
      parameters: Record<string, unknown>;
      execute(id: string, params: Record<string, unknown>): Promise<unknown>;
    },
    meta: { name: string },
  ): void;
};

function summarizeCandidate(candidate: ReturnType<typeof scoreCandidates>[number]): string {
  return JSON.stringify(
    {
      repo: candidate.repo.fullName,
      finalUpgradeScore: candidate.score.finalUpgradeScore,
      eligibleForValidation: candidate.score.eligibleForValidation,
      hardVetoReasons: candidate.score.hardVetoReasons,
      summary: candidate.score.summary,
    },
    null,
    2,
  );
}

function registerScanTool(api: PluginApi): void {
  api.registerTool(
    (ctx) => ({
      name: "radar_scan_candidates",
      label: "Radar Scan Candidates",
      description: "Scan watched GitHub repos/topics and return the highest scoring upgrade candidates.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          useFixtures: { type: "boolean", description: "Use local fixtures instead of live GitHub data." },
          topN: { type: "number", description: "Maximum number of candidates to return." },
        },
      },
      async execute(_id, params) {
        const runtime = await loadRadarRuntime({
          workspaceRoot: ctx.workspaceDir,
          useFixtures: params.useFixtures === true,
        });
        const scored = scoreCandidates(await scanRepositories(runtime), runtime.config).slice(
          0,
          typeof params.topN === "number" ? params.topN : runtime.config.reporting.topN,
        );

        return {
          content: scored.map((candidate) => ({ type: "text", text: summarizeCandidate(candidate) })),
          details: scored,
        };
      },
    }),
    { name: "radar_scan_candidates" },
  );
}

function registerPlanTool(api: PluginApi): void {
  api.registerTool(
    (ctx) => ({
      name: "radar_generate_upgrade_plan",
      label: "Radar Generate Upgrade Plan",
      description: "Generate an explicit upgrade plan for a candidate repo detected by the radar.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["repository"],
        properties: {
          repository: { type: "string", description: "Full repo name such as openai/openai-agents-python." },
          useFixtures: { type: "boolean", description: "Use local fixture data." },
        },
      },
      async execute(_id, params) {
        const runtime = await loadRadarRuntime({
          workspaceRoot: ctx.workspaceDir,
          useFixtures: params.useFixtures === true,
        });
        const candidates = scoreCandidates(await scanRepositories(runtime), runtime.config);
        const candidate = candidates.find((item) => item.repo.fullName === params.repository);

        if (!candidate) {
          throw new Error(`Candidate not found: ${String(params.repository)}`);
        }

        const plan = createUpgradePlan(candidate, runtime.config);
        return {
          content: [{ type: "text", text: JSON.stringify(plan, null, 2) }],
          details: plan,
        };
      },
    }),
    { name: "radar_generate_upgrade_plan" },
  );
}

function registerRunTool(api: PluginApi): void {
  api.registerTool(
    (ctx) => ({
      name: "radar_run_daily",
      label: "Radar Run Daily",
      description:
        "Run the full daily AI architecture radar cycle, write reports/state, and optionally create isolated upgrade attempts.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          dryRun: {
            type: "boolean",
            description: "Keep git and PR actions in dry-run mode while still writing reports and state.",
          },
          useFixtures: { type: "boolean", description: "Use local fixture data instead of live GitHub calls." },
          topN: { type: "number", description: "Maximum candidates to evaluate this run." },
        },
      },
      async execute(_id, params) {
        const runtime = await loadRadarRuntime({
          workspaceRoot: ctx.workspaceDir,
          useFixtures: params.useFixtures === true,
        });
        const result = await runDailyRadarCycle(runtime, {
          dryRun: params.dryRun !== false,
          candidateLimit: typeof params.topN === "number" ? params.topN : undefined,
        });

        return {
          content: [{ type: "text", text: renderDailyReport(result) }],
          details: result,
        };
      },
    }),
    { name: "radar_run_daily" },
  );
}

export default function register(api: PluginApi): void {
  registerScanTool(api);
  registerPlanTool(api);
  registerRunTool(api);
  api.logger?.info?.("[github-architecture-radar] registered radar tools");
}
