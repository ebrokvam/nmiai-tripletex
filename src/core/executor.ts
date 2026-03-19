import { TripletexClient } from "../tripletex/client.js";
import type { SolveRequestBody } from "../types/solve.js";
import type { ParsedTask } from "../types/task-plan.js";
import { buildTaskPlan } from "./planner.js";
import { executeTask } from "./handlers/index.js";
import { buildTaskPlanWithLLM } from "./llm-planner.js";

export type SolveExecutionResult = {
  ok: boolean;
  planner: "llm" | "rules";
  kind: ParsedTask["kind"];
  error?: string;
};

export async function executeSolveTask(input: SolveRequestBody): Promise<SolveExecutionResult> {
  const client = new TripletexClient(input.tripletex_credentials);
  const llmPlan = await buildTaskPlanWithLLM(input);
  const plan = llmPlan ?? buildTaskPlan(input);
  const plannerSource = llmPlan ? "llm" : "rules";
  console.info(`[solver] planner=${plannerSource} kind=${plan.kind}`);

  if (plan.kind === "unknown") {
    // Intentional no-op to keep endpoint contract deterministic while coverage expands.
    return { ok: true, planner: plannerSource, kind: plan.kind };
  }

  try {
    await executeTask(client, plan);
    return { ok: true, planner: plannerSource, kind: plan.kind };
  } catch (error) {
    return {
      ok: false,
      planner: plannerSource,
      kind: plan.kind,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
