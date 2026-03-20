import type { SolveRequestBody } from "../types/solve.js";
import type { AgentTaskPlan } from "../types/task-plan.js";
import { executeWithLLMAgent } from "./llm-agent-executor.js";
import { prepareInputFiles } from "./input-files.js";
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
  const runId =
    context?.runId ?? new Date().toISOString().replace(/[:.]/g, "-");
  const preparedFiles = prepareInputFiles({
    runId,
    files: input.files,
  });
  let llmPlan: AgentTaskPlan;
  try {
    llmPlan = await buildTaskPlanWithLLM(input, {
      preparedFiles,
    });
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
    runId,
    plan: llmPlan,
  });

  const agentResult = await executeWithLLMAgent(
    input,
    llmPlan,
    {
      runId,
      preparedFiles,
    },
  );
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
