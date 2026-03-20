import type { SolveRequestBody } from "../types/solve.js";
import type { AgentTaskPlan } from "../types/task-plan.js";
import { executeWithLLMAgent } from "./llm-agent-executor.js";
import { buildTaskPlanWithLLM } from "./llm-planner.js";
import { writePlanLog } from "./run-log.js";

export type SolveExecutionResult = {
  ok: boolean;
  planningError?: string;
  error?: string;
};

export async function executeSolveTask(
  input: SolveRequestBody,
  context?: { runId?: string },
): Promise<SolveExecutionResult> {
  console.info(input.prompt);
  let llmPlan: AgentTaskPlan;
  try {
    llmPlan = await buildTaskPlanWithLLM(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.info(`planning failed`);
    console.info(message);
    return {
      ok: false,
      planningError: message,
      error: message,
    };
  }

  console.info(`planning complete`);
  console.info(llmPlan);
  writePlanLog({
    runId: context?.runId,
    plan: llmPlan,
  });

  const agentResult = await executeWithLLMAgent(input, llmPlan, context);
  if (agentResult.ok) {
    return {
      ok: true,
    };
  }

  return {
    ok: false,
    error: agentResult.error,
  };
}
