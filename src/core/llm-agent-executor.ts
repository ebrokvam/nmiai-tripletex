import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SolveRequestBody } from "../types/solve.js";
import type { PlannedTask } from "../types/task-plan.js";
import { startCodexThread } from "./codex-client.js";
import { buildCommonRequestTemplateCatalog } from "./tripletex-common-request-templates.js";

type AgentRunResult = {
  ok: boolean;
  error?: string;
};

type ExecutionResponse = {
  ok: boolean;
  error: string | null;
};

const EXECUTION_TIMEOUT_MS = 3 * 60 * 1000;

const EXECUTION_SCHEMA = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    error: { type: ["string", "null"] },
  },
  required: ["ok", "error"],
  additionalProperties: false,
} as const;

export async function executeWithLLMAgent(
  input: SolveRequestBody,
  parsedPlan: PlannedTask,
  context?: { runId?: string },
): Promise<AgentRunResult> {
  const runId =
    context?.runId ?? new Date().toISOString().replace(/[:.]/g, "-");
  const requestLogFile = resolve(
    process.cwd(),
    `.solve-logs/runs/${runId}/http-requests.json`,
  );
  const thread = startCodexThread(
    {
      sandboxMode: "danger-full-access",
      networkAccessEnabled: true,
    },
    {
      config: buildTripletexMcpConfig(input, requestLogFile),
    },
  );

  const prompt = buildExecutionPrompt(input, parsedPlan, requestLogFile);
  const transcript = createCodexTranscriptLogger(
    runId,
    input.tripletex_credentials.session_token,
  );

  try {
    const signal = AbortSignal.timeout(EXECUTION_TIMEOUT_MS);
    const streamed = await thread.runStreamed(prompt, {
      outputSchema: EXECUTION_SCHEMA,
      signal,
    });
    const completedAgentMessages: string[] = [];
    const completedReasoning: string[] = [];
    const commandTimeline: Array<{
      command: string;
      status: string;
      exitCode?: number;
    }> = [];

    let latestAgentMessage = "";
    let failedTurnMessage: string | undefined;

    for await (const event of streamed.events) {
      if (event.type === "turn.failed") {
        failedTurnMessage = event.error.message;
      }

      if (
        (event.type === "item.started" ||
          event.type === "item.updated" ||
          event.type === "item.completed") &&
        event.item.type === "agent_message"
      ) {
        latestAgentMessage = event.item.text;
      }

      if (
        event.type === "item.completed" &&
        event.item.type === "agent_message"
      ) {
        completedAgentMessages.push(event.item.text);
      }

      if (event.type === "item.completed" && event.item.type === "reasoning") {
        completedReasoning.push(event.item.text);
      }

      if (
        (event.type === "item.updated" || event.type === "item.completed") &&
        event.item.type === "command_execution" &&
        event.item.status !== "in_progress"
      ) {
        commandTimeline.push({
          command: event.item.command,
          status: event.item.status,
          exitCode: event.item.exit_code,
        });
      }
    }

    if (failedTurnMessage) {
      const formattedError = `LLM execution failed: ${failedTurnMessage}`;
      transcript.logExecutionError(formattedError);
      return {
        ok: false,
        error: formattedError,
      };
    }

    const finalResponse = latestAgentMessage;
    transcript.logAgentMessages(completedAgentMessages, finalResponse);
    transcript.logReasoning(completedReasoning);
    transcript.logCommandTimeline(commandTimeline);
    transcript.logFinalResponse(finalResponse);

    const result = parseExecutionResponse(finalResponse);
    if (!result) {
      return {
        ok: false,
        error: `LLM execution returned invalid response: ${finalResponse.slice(0, 300)}`,
      };
    }

    return result.ok
      ? { ok: true }
      : { ok: false, error: result.error ?? "LLM execution failed" };
  } catch (error) {
    const formattedError = formatCodexError(error, "LLM execution");
    transcript.logExecutionError(formattedError);
    return {
      ok: false,
      error: formattedError,
    };
  } finally {
    transcript.close();
  }
}

function buildExecutionPrompt(
  input: SolveRequestBody,
  parsedPlan: PlannedTask,
  requestLogFile: string,
): string {
  const filesSummary = (input.files ?? []).map((file) => ({
    filename: file.filename,
    mime_type: file.mime_type,
    content_base64_length: file.content_base64.length,
  }));

  return [
    "You are a Tripletex execution agent.",
    "Execute the given plan end-to-end by making real HTTP requests.",
    "Do not expose credentials or authorization headers in your final response.",
    "The user prompt is the source of truth, but the provided plan packet is your primary execution program.",
    "Use the provided common_request_templates catalog as your first fallback when you need to extend or repair the plan.",
    "A planning agent has already prepared lookup_requests, mutation_requests, request shapes, and formatting guidance for you.",
    "Execute the plan as written unless the next planned request cannot be sent successfully because a required value is missing, a placeholder is unresolved, the body shape conflicts with the OpenAPI schema, or a prior API response requires recovery.",
    "Execute lookup_requests first, then mutation_requests.",
    "For each planned request, use its method, path, query_json, body_json, and format_requirements as the default request definition.",
    "Parse query_json and body_json from JSON strings, then replace placeholders with concrete values resolved from earlier requests before sending them.",
    "Do not add extra requests if the plan already contains enough information to complete the task safely.",
    "If the plan is partial, empty, or blocked by missing information, extend it with the fewest additional requests needed to complete the task.",
    "When you need an extra request beyond the plan, first look for a suitable request shape in common_request_templates.",
    "Only inspect the local OpenAPI schema when neither the plan nor common_request_templates provide a sufficient next step, or when you need to validate an uncertain endpoint or nested body shape.",
    "",
    "Execution environment:",
    `- Base URL: ${input.tripletex_credentials.base_url}`,
    `- Per-solve HTTP log file: ${requestLogFile}`,
    "- Available MCP tool: tripletex_request",
    "- Local OpenAPI schema file: ./openapi.json",
    "",
    "Mandatory execution setup:",
    "- For ALL Tripletex API requests, call the tripletex_request MCP tool.",
    "- The MCP tool already handles the base URL, authentication, JSON headers, and request logging.",
    "",
    "Tool contract:",
    "- tripletex_request input: { method, path, query?, body? }",
    "- method must be one of GET, POST, PUT, DELETE.",
    "- path must start with /.",
    '- query must be an object with string values, for example {"count":"20","fields":"id,name"}.',
    "- body must be a JSON object when required by the endpoint.",
    "- tripletex_request output includes: ok, status, statusText, url, method, path, body, error.",
    "",
    "Request template (copy this format):",
    '- GET: tripletex_request({ method: "GET", path: "/employee", query: { fields: "id,firstName,lastName,email", count: "20" } })',
    '- POST: tripletex_request({ method: "POST", path: "/customer", body: { name: "Example AS" } })',
    "",
    "Request rules:",
    "- Prefer GET before mutating when IDs are needed.",
    "- Prefer values resolved from earlier lookup_requests over guessing.",
    "- Reuse data from earlier responses whenever possible so you do not repeat equivalent lookups.",
    "- When you add a request beyond the plan, make it the narrowest request that resolves the blocker.",
    "- Use the local OpenAPI schema to validate candidate endpoints and nested request shapes before making uncertain calls.",
    "- Tripletex returns detailed error messages. Parse them and retry with corrections when the error indicates a recoverable issue.",
    "- For 401 Unauthorized, treat this as an authentication or environment problem. Do not invent auth headers manually; the MCP tool already handles authentication.",
    "- For 404 Not Found, verify the endpoint path against the plan and the local OpenAPI schema before retrying.",
    "- For 422 Validation Error or other validation-style 4xx responses, read the error message, correct the missing or malformed fields, and retry with the smallest necessary change.",
    '- If a GET returns an empty values array, treat it as "no matching result found". First broaden or correct the search only if the current lookup is likely too narrow; otherwise stop and return a concrete blocker.',
    "- Keep working until the user request is completed or a concrete API failure blocks execution.",
    "",
    "Return contract:",
    "- Return JSON object matching schema: { ok: boolean, error: string|null }.",
    "- Use ok=true and error=null only if execution completed successfully.",
    "- Use ok=false with a short actionable error when blocked or failed.",
    "- If execution fails, report the actual blocker, not a vague summary.",
    "",
    "Original user request:",
    input.prompt,
    "",
    "Common request templates:",
    JSON.stringify(buildCommonRequestTemplateCatalog(), null, 2),
    "",
    "Task packet:",
    JSON.stringify(parsedPlan, null, 2),
  ].join("\n");
}

function buildTripletexMcpConfig(
  input: SolveRequestBody,
  requestLogFile: string,
): NonNullable<Parameters<typeof startCodexThread>[1]>["config"] {
  return {
    mcp_servers: {
      tripletex: {
        command: process.execPath,
        args: [resolve(process.cwd(), "scripts/tripletex-mcp-server.mjs")],
        env: {
          TRIPLETEX_BASE_URL: input.tripletex_credentials.base_url,
          TRIPLETEX_SESSION_TOKEN: input.tripletex_credentials.session_token,
          TRIPLETEX_HTTP_LOG_FILE: requestLogFile,
        },
      },
    },
  };
}

function parseExecutionResponse(
  content: string,
): ExecutionResponse | undefined {
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  if (!("ok" in parsed) || typeof parsed.ok !== "boolean") {
    return undefined;
  }

  if (!("error" in parsed)) {
    return undefined;
  }

  if (parsed.error !== null && typeof parsed.error !== "string") {
    return undefined;
  }

  return parsed as ExecutionResponse;
}

function toBasicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64",
  );
  return `Basic ${token}`;
}

function formatCodexError(error: unknown, label: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.toLowerCase().includes("abort") ||
    message.toLowerCase().includes("timed out")
  ) {
    return `${label} failed: exceeded ${EXECUTION_TIMEOUT_MS / 1000} second time limit.`;
  }
  if (
    message.toLowerCase().includes("auth") ||
    message.toLowerCase().includes("api key") ||
    message.toLowerCase().includes("unauthorized")
  ) {
    return `${label} failed: ${message}. Run codex login for this environment.`;
  }
  return `${label} failed: ${message}`;
}

function createCodexTranscriptLogger(
  runId: string,
  sessionToken: string,
): {
  logAgentMessages: (messages: string[], finalResponse: string) => void;
  logReasoning: (messages: string[]) => void;
  logCommandTimeline: (
    timeline: Array<{ command: string; status: string; exitCode?: number }>,
  ) => void;
  logFinalResponse: (response: string) => void;
  logExecutionError: (message: string) => void;
  close: () => void;
} {
  const runDirectory = resolve(process.cwd(), ".solve-logs", "runs", runId);
  const transcriptPath = resolve(runDirectory, "codex-transcript.md");
  mkdirSync(runDirectory, { recursive: true });

  writeFileSync(
    transcriptPath,
    [
      "# Codex Transcript",
      "",
      `- Run ID: ${runId}`,
      `- Created: ${new Date().toISOString()}`,
      "",
    ].join("\n"),
    "utf8",
  );

  const basicToken = Buffer.from(`0:${sessionToken}`, "utf8").toString(
    "base64",
  );
  const secrets = [sessionToken, basicToken, `Basic ${basicToken}`];

  const logFinalResponse = (response: string): void => {
    appendFileSync(
      transcriptPath,
      [
        "## Final Response",
        "",
        "```json",
        redactString(response, secrets),
        "```",
        "",
      ].join("\n"),
      "utf8",
    );
  };

  const logAgentMessages = (
    messages: string[],
    finalResponse: string,
  ): void => {
    const uniqueMessages: string[] = [];
    let previous = "";
    for (const message of messages) {
      if (message !== previous && message !== finalResponse) {
        uniqueMessages.push(message);
        previous = message;
      }
    }

    if (!uniqueMessages.length) {
      appendFileSync(
        transcriptPath,
        [
          "## Agent Messages",
          "",
          "_No intermediate assistant messages were emitted for this run._",
          "",
        ].join("\n"),
        "utf8",
      );
      return;
    }

    appendFileSync(
      transcriptPath,
      [
        "## Agent Messages",
        "",
        ...uniqueMessages.map((message, index) => {
          const safe = redactString(message, secrets);
          return `${index + 1}. ${safe}`;
        }),
        "",
      ].join("\n"),
      "utf8",
    );
  };

  const logReasoning = (messages: string[]): void => {
    if (!messages.length) {
      return;
    }

    appendFileSync(
      transcriptPath,
      [
        "## Reasoning Summaries",
        "",
        ...messages.map((message, index) => {
          const safe = redactString(message, secrets);
          return `${index + 1}. ${safe}`;
        }),
        "",
      ].join("\n"),
      "utf8",
    );
  };

  const logCommandTimeline = (
    timeline: Array<{ command: string; status: string; exitCode?: number }>,
  ): void => {
    if (!timeline.length) {
      return;
    }

    appendFileSync(
      transcriptPath,
      [
        "## Command Timeline",
        "",
        ...timeline.map((entry, index) => {
          const safeCommand = redactString(entry.command, secrets);
          const exit =
            entry.exitCode === undefined ? "-" : String(entry.exitCode);
          return `${index + 1}. [${entry.status}] (exit=${exit}) \`${safeCommand}\``;
        }),
        "",
      ].join("\n"),
      "utf8",
    );
  };

  const logExecutionError = (message: string): void => {
    appendFileSync(
      transcriptPath,
      ["## Execution Error", "", redactString(message, secrets), ""].join("\n"),
      "utf8",
    );
  };

  const close = (): void => {
    // No-op for file logger.
  };

  return {
    logAgentMessages,
    logReasoning,
    logCommandTimeline,
    logFinalResponse,
    logExecutionError,
    close,
  };
}

function redactString(value: string, secrets: string[]): string {
  let output = value;

  for (const secret of secrets) {
    if (secret) {
      output = output.split(secret).join("REDACTED");
    }
  }

  output = output.replace(/\bBasic\s+[A-Za-z0-9+/=._-]+\b/g, "Basic REDACTED");

  return output;
}
