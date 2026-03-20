import type { SolveRequestBody } from "../types/solve.js";
import type { AgentTaskPlan } from "../types/task-plan.js";
import { startCodexThread } from "./codex-client.js";

const LOCAL_OPENAPI_PATH = "./openapi.json";

const PLAN_SCHEMA = {
  type: "object",
  properties: {
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
          query_json: { type: ["string", "null"] },
          body_json: { type: ["string", "null"] },
          format_requirements: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "method",
          "path",
          "purpose",
          "query_json",
          "body_json",
          "format_requirements",
        ],
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
          query_json: { type: ["string", "null"] },
          body_json: { type: ["string", "null"] },
          format_requirements: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "method",
          "path",
          "purpose",
          "query_json",
          "body_json",
          "format_requirements",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "intent",
    "input_arguments",
    "lookup_requests",
    "mutation_requests",
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
      "Supported languages include Norwegian, English, Spanish, Portuguese, Nynorsk, German, French.",
      `Read the local OpenAPI schema at ${LOCAL_OPENAPI_PATH} before producing the plan to choose the correct endpoints and exact request format.`,
      "Your job is to convert the user request into precise API request templates.",
      "Search broadly inside the schema before concluding that a task is impossible. Check direct endpoints, related resource groups, and referenced component schemas that may define nested writable objects.",
      "If a direct endpoint for the exact business phrasing is not obvious, decompose the task into lookups plus the closest supported mutation flow instead of giving up.",
      "When a mutation endpoint exists but some nested fields must be inferred from related schemas, still return a plan and use placeholders in body_json for unresolved IDs, enum values, or salary-type selections.",
      "Use format_requirements to explain how placeholders must be resolved from earlier lookups and to record any schema-based assumptions about nested objects.",
      "Never give up. Always return a plan, even when it is partial, ambiguous, or relies on placeholders and follow-up lookups.",
      "Minimize the total number of API requests. Prefer the smallest viable plan that can complete the task safely.",
      "Choose a short intent label and normalize important prompt values into input_arguments.",
      "Use lookup_requests only for requests that resolve IDs or required facts before mutation.",
      "Do not include lookup_requests for optional confirmation, exploratory reads, or data that is already present in the user prompt.",
      "If a mutation can be executed safely from known inputs, return an empty lookup_requests array.",
      "If one lookup can resolve multiple required values, prefer that single lookup over several narrower requests.",
      "Use mutation_requests for the main write operations. Use an empty array when no write should happen.",
      "For every planned request, fill query_json with the exact query object serialized as a JSON string, or null if none.",
      "For every planned request, fill body_json with the exact minimal request body serialized as a JSON string, or null if none.",
      "Use format_requirements to state precise formatting rules from OpenAPI, such as required nested objects, enums, field formats, or placeholder values that must be substituted from lookup results.",
      "For payroll and salary tasks, inspect salary transaction, payslip, salary specification, salary type, employee, and salary settings schemas together before deciding whether the task is plannable.",
      "Always include all schema fields. Use empty arrays or null where not applicable.",
    ],
  };

  try {
    const thread = startCodexThread();
    const turn = await thread.run(JSON.stringify(payload), {
      outputSchema: PLAN_SCHEMA,
    });

    const plan = parsePlan(turn.finalResponse);
    if (!plan) {
      throw new Error(
        `LLM planner response did not match AgentTaskPlan schema, raw=${turn.finalResponse.slice(0, 500)}`,
      );
    }

    return plan;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`LLM planner failed: ${message}`);
  }
}

function parsePlan(raw: string): AgentTaskPlan | undefined {
  const parsed = JSON.parse(raw) as AgentTaskPlan;
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }

  return typeof parsed.intent === "string" &&
    Array.isArray(parsed.input_arguments) &&
    Array.isArray(parsed.lookup_requests) &&
    Array.isArray(parsed.mutation_requests)
    ? parsed
    : undefined;
}
