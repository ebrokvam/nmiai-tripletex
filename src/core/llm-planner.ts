import type { SolveRequestBody } from "../types/solve.js";
import type { AgentTaskPlan } from "../types/task-plan.js";
import { startCodexThread } from "./codex-client.js";
import type { PreparedInputFile } from "./input-files.js";
import { COMMON_TASK_PATTERN_GUIDANCE } from "./tripletex-common-task-patterns.js";
import { buildCommonRequestTemplateCatalog } from "./tripletex-common-request-templates.js";

const LOCAL_OPENAPI_PATH = "./openapi.json";

const PLAN_SCHEMA = {
  type: "object",
  properties: {
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
  required: ["lookup_requests", "mutation_requests"],
  additionalProperties: false,
} as const;

export async function buildTaskPlanWithLLM(
  input: SolveRequestBody,
  context?: { preparedFiles?: PreparedInputFile[] },
): Promise<AgentTaskPlan> {
  const filesSummary = (input.files ?? []).map((file) => ({
    filename: file.filename,
    mime_type: file.mime_type,
    content_base64_length: file.content_base64.length,
  }));
  const preparedFiles = context?.preparedFiles ?? [];

  const payload = {
    prompt: input.prompt,
    files: filesSummary,
    attached_files: preparedFiles.map((file) => ({
      filename: file.filename,
      mime_type: file.mime_type,
      path: file.path,
      is_image: file.is_image,
    })),
    common_request_templates: buildCommonRequestTemplateCatalog(),
    common_task_patterns: COMMON_TASK_PATTERN_GUIDANCE,
    instructions: [
      "Create a compact execution packet for a Tripletex action request.",
      "Supported languages include Norwegian, English, Spanish, Portuguese, Nynorsk, German, French.",
      "Your job is to convert the user request into precise API request templates.",
      "If attached_files are present, inspect the relevant files before planning when they may contain task-critical information such as invoice numbers, amounts, dates, counterparties, product lines, or other source data.",
      "First inspect common_request_templates and common_task_patterns.",
      "Use common_task_patterns to choose the flow shape: single creation, create with linking, modify existing, delete or reverse, or multi-step setup.",
      "When a common_request_templates entry matches the task, copy and adapt it instead of inventing a new request.",
      "Minimize the total number of API requests. Prefer the smallest viable plan that can complete the task safely.",
      "Use lookup_requests only for requests that resolve IDs or required facts before mutation.",
      "Do not include lookup_requests for optional confirmation, exploratory reads, or data that is already present in the user prompt.",
      "If a mutation can be executed safely from known inputs, return an empty lookup_requests array.",
      "If one lookup can resolve multiple required values, prefer that single lookup over several narrower requests.",
      "For multi-step setup tasks, include only the dependency chain required for the final outcome, and prefer embedded creation when the schema supports it.",
      "Use mutation_requests for the main write operations. Use an empty array when no write should happen.",
      "For every planned request, fill query_json with the exact query object serialized as a JSON string, or null if none.",
      "Encode query_json using strings by default. Use arrays of strings only for query parameters that the OpenAPI schema defines as array parameters.",
      "Do not put numbers or booleans directly inside query_json; encode them in the string form expected by the API.",
      "Prefer batched lookups when the schema or docs clearly support list query parameters; otherwise do not guess the encoding.",
      "For GET requests, request only the fields needed for later steps. Do not include extra fields for convenience.",
      'Use "fields":"*" only when the full entity shape must be inspected to resolve an uncertain field, nested object, or schema mismatch.',
      "For every planned request, fill body_json with the exact minimal request body serialized as a JSON string, or null if none.",
      "Use format_requirements to state precise formatting rules from OpenAPI, such as required nested objects, enums, field formats, or placeholder values that must be substituted from lookup results.",
      "If a mutation endpoint exists but some nested fields must be inferred from related schemas, still return a plan and use placeholders in body_json for unresolved IDs, enum values, or nested object selections.",
      "Account for likely environment prerequisites for the target flow, such as required company setup or enabled modules, when the schema or endpoint behavior indicates they may block execution.",
      "Do not invent unrelated setup mutations in the plan, but use format_requirements to call out likely environment blockers that the executor should watch for.",
      `Only if the task cannot be achieved through the provided common_request_templates should you inspect the local OpenAPI schema at ${LOCAL_OPENAPI_PATH} to find other endpoints or exact request formats.`,
      "When using the full schema, search broadly and keep extending the plan until you have the best available lookup-plus-mutation flow for the user request. Check direct endpoints, related resource groups, and referenced component schemas that may define nested writable objects.",
      "Always return the best available plan, even when it is partial or relies on placeholders and follow-up lookups.",
      "For payroll and salary tasks, inspect salary transaction, payslip, salary specification, salary type, employee, and salary settings schemas together and return the closest supported end-to-end flow with placeholders where needed.",
    ],
  };

  try {
    const thread = startCodexThread();
    const turn = await thread.run(buildPlannerInput(payload, preparedFiles), {
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

function buildPlannerInput(
  payload: unknown,
  preparedFiles: PreparedInputFile[],
): Array<{ type: "text"; text: string } | { type: "local_image"; path: string }> {
  const items: Array<
    { type: "text"; text: string } | { type: "local_image"; path: string }
  > = [
    {
      type: "text",
      text: JSON.stringify(payload),
    },
  ];

  for (const file of preparedFiles) {
    if (!file.is_image) {
      continue;
    }

    items.push({
      type: "local_image",
      path: file.path,
    });
  }

  return items;
}

function parsePlan(raw: string): AgentTaskPlan | undefined {
  const parsed = JSON.parse(raw) as AgentTaskPlan;
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }

  return Array.isArray(parsed.lookup_requests) &&
    Array.isArray(parsed.mutation_requests)
    ? parsed
    : undefined;
}
