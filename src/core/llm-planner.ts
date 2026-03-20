import type { SolveRequestBody } from "../types/solve.js";
import type { AgentTaskPlan } from "../types/task-plan.js";
import { startCodexThread } from "./codex-client.js";

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["planned", "cannot_plan"] },
    summary: { type: "string" },
    intent: { type: "string" },
    input_arguments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "string" },
        },
        required: ["name", "value"],
        additionalProperties: false,
      },
    },
    lookup_requests: {
      type: "array",
      items: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: { type: "string" },
          purpose: { type: "string" },
          query_hint: { type: ["string", "null"] },
          body_hint: { type: ["string", "null"] },
        },
        required: ["method", "path", "purpose", "query_hint", "body_hint"],
        additionalProperties: false,
      },
    },
    mutation_requests: {
      type: "array",
      items: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: { type: "string" },
          purpose: { type: "string" },
          query_hint: { type: ["string", "null"] },
          body_hint: { type: ["string", "null"] },
        },
        required: ["method", "path", "purpose", "query_hint", "body_hint"],
        additionalProperties: false,
      },
    },
    verification_requests: {
      type: "array",
      items: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
          path: { type: "string" },
          purpose: { type: "string" },
          query_hint: { type: ["string", "null"] },
          body_hint: { type: ["string", "null"] },
        },
        required: ["method", "path", "purpose", "query_hint", "body_hint"],
        additionalProperties: false,
      },
    },
    stop_conditions: { type: "array", items: { type: "string" } },
    reason: { type: ["string", "null"] },
  },
  required: [
    "status",
    "summary",
    "intent",
    "input_arguments",
    "lookup_requests",
    "mutation_requests",
    "verification_requests",
    "stop_conditions",
    "reason",
  ],
  additionalProperties: false,
} as const;

export async function buildTaskPlanWithLLM(
  input: SolveRequestBody,
): Promise<AgentTaskPlan> {
  const filesSummary = (input.files ?? []).map((file) => ({
    filename: file.filename,
    mime_type: file.mime_type,
    content_base64_length: file.content_base64.length,
  }));

  const payload = {
    prompt: input.prompt,
    files: filesSummary,
    instructions: [
      "Create a compact execution packet for a Tripletex action request.",
      "Return only the minimum fields an execution agent needs.",
      "Use status=cannot_plan only when the prompt is too ambiguous or impossible.",
      "When status=planned, choose a short intent label and normalize important prompt values into input_arguments.",
      "Use lookup_requests only for requests that resolve IDs or required facts before mutation.",
      "Use mutation_requests for the main write operations. Use an empty array when no write should happen.",
      "Use verification_requests only for checks that confirm success.",
      "Use stop_conditions for concise blockers that should halt execution.",
      "Keep summary and purpose text brief and operational, not explanatory.",
      "Do not include generic reasoning, duplicate the user prompt, or write prose plans.",
      "Always include all schema fields. Use empty arrays or null where not applicable.",
      "Supported languages include Norwegian, English, Spanish, Portuguese, Nynorsk, German, French.",
    ],
  };

  try {
    const thread = startCodexThread();
    const turn = await thread.run(
      [
        "You are a Tripletex planning agent.",
        "Return only structured JSON matching the schema.",
        "",
        JSON.stringify(payload),
      ].join("\n"),
      { outputSchema: PLAN_SCHEMA },
    );

    const plan = parsePlan(turn.finalResponse);
    if (!plan) {
      return cannotPlan(
        `LLM planner response did not match AgentTaskPlan schema, raw=${turn.finalResponse.slice(0, 500)}`,
      );
    }

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return cannotPlan(`LLM planner failed: ${message}`);
  }
}

function cannotPlan(reason: string): AgentTaskPlan {
  return {
    status: "cannot_plan",
    reason,
    summary: "Planner could not create a safe execution plan",
  };
}

function parsePlan(raw: string): AgentTaskPlan | undefined {
  const parsed = JSON.parse(raw) as AgentTaskPlan;
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }

  if (parsed.status === "cannot_plan") {
    return typeof parsed.reason === "string" ? parsed : undefined;
  }

  if (parsed.status !== "planned") {
    return undefined;
  }

  return typeof parsed.intent === "string" &&
    typeof parsed.summary === "string" &&
    Array.isArray(parsed.input_arguments) &&
    Array.isArray(parsed.lookup_requests) &&
    Array.isArray(parsed.mutation_requests) &&
    Array.isArray(parsed.verification_requests)
    ? parsed
    : undefined;
}
