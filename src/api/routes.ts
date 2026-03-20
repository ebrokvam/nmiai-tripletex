import type { FastifyInstance } from "fastify";
import { executeSolveTask } from "../core/executor.js";
import { writeSolveLog } from "../core/run-log.js";
import type { SolveRequestBody, SolveResponseBody } from "../types/solve.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: SolveRequestBody; Reply: SolveResponseBody }>(
    "/solve",
    async (request, reply) => {
      const startedAt = Date.now();
      const runId = new Date(startedAt).toISOString().replace(/[:.]/g, "-");

      try {
        const result = await executeSolveTask(request.body, { runId });
        if (!result.ok) {
          app.log.error({ result }, "solve execution failed");
        }
        writeSolveLog({
          runId,
          requestId: String(request.id),
          body: request.body,
          result,
          durationMs: Date.now() - startedAt,
        });

        return reply.code(200).send({
          status: "completed",
          debug: {
            ok: result.ok,
            planner: "llm",
            plan_summary: result.planSummary,
            planning_error: result.planningError,
            error: result.error,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        app.log.error({ err: error }, "solve request validation failed");
        writeSolveLog({
          runId,
          requestId: String(request.id),
          body: request.body as SolveRequestBody,
          result: { ok: false, error: message },
          durationMs: Date.now() - startedAt,
        });

        return reply.code(200).send({
          status: "completed",
          debug: {
            ok: false,
            error: message,
          },
        });
      }
    },
  );
}
