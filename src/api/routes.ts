import type { FastifyInstance } from "fastify";
import type { SolveRequestBody, SolveResponseBody } from "../types/solve.js";
import { executeSolveTask } from "../core/executor.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: SolveRequestBody; Reply: SolveResponseBody }>("/solve", async (request, reply) => {
    const debugEnabled = process.env.SOLVER_DEBUG_RESPONSE === "true";

    try {
      const effectiveInput = applyCredentialFallback(request.body);
      validateSolveRequest(effectiveInput);

      const result = await executeSolveTask(effectiveInput);
      if (!result.ok) {
        app.log.error({ result }, "solve execution failed");
      }

      return reply.code(200).send({
        status: "completed",
        ...(debugEnabled ? { debug: result } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      app.log.error({ err: error }, "solve request validation failed");

      return reply.code(200).send({
        status: "completed",
        ...(debugEnabled ? { debug: { ok: false, error: message } } : {}),
      });
    }
  });
}

function applyCredentialFallback(input: SolveRequestBody): SolveRequestBody {
  const hasCredentials =
    input?.tripletex_credentials?.base_url && input?.tripletex_credentials?.session_token;
  if (hasCredentials) {
    return input;
  }

  const envBaseUrl = process.env.TRIPLETEX_BASE_URL;
  const envSessionToken = process.env.TRIPLETEX_SESSION_TOKEN;
  if (!envBaseUrl || !envSessionToken) {
    return input;
  }

  return {
    ...input,
    tripletex_credentials: {
      base_url: envBaseUrl,
      session_token: envSessionToken,
    },
  };
}

function validateSolveRequest(input: SolveRequestBody): void {
  if (!input || typeof input !== "object") {
    throw new Error("Body must be a JSON object.");
  }

  if (!input.prompt || typeof input.prompt !== "string") {
    throw new Error("Field 'prompt' is required and must be a string.");
  }

  if (!input.tripletex_credentials || typeof input.tripletex_credentials !== "object") {
    throw new Error("Field 'tripletex_credentials' is required.");
  }

  if (!input.tripletex_credentials.base_url || !input.tripletex_credentials.session_token) {
    throw new Error("tripletex_credentials must include base_url and session_token.");
  }

  if (input.files && !Array.isArray(input.files)) {
    throw new Error("Field 'files' must be an array when provided.");
  }
}
