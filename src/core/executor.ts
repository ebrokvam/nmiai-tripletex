import type { SolveRequestBody } from "../types/solve.js";
import type { AgentTaskPlan } from "../types/task-plan.js";
import { executeWithLLMAgent } from "./llm-agent-executor.js";
import { buildTaskPlanWithLLM } from "./llm-planner.js";

export type SolveExecutionResult = {
  ok: boolean;
  planStatus: AgentTaskPlan["status"];
  planSummary?: string;
  error?: string;
};

export async function executeSolveTask(
  input: SolveRequestBody,
  context?: { runId?: string },
): Promise<SolveExecutionResult> {
  const llmPlan = await buildTaskPlanWithLLM(input);

  console.info(`[solver] plan_status=${llmPlan.status}`);
  console.info(llmPlan);

  if (llmPlan.status === "cannot_plan") {
    return {
      ok: false,
      planStatus: llmPlan.status,
      planSummary: llmPlan.summary,
      error: llmPlan.reason,
    };
  }

  const agentResult = await executeWithLLMAgent(input, llmPlan, context);
  if (agentResult.ok) {
    return {
      ok: true,
      planStatus: llmPlan.status,
      planSummary: llmPlan.summary,
    };
  }

  return {
    ok: false,
    planStatus: llmPlan.status,
    planSummary: llmPlan.summary,
    error: agentResult.error,
  };
}
