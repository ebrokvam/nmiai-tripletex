import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SolveRequestBody } from "../types/solve.js";
import type { SolveExecutionResult } from "./executor.js";

type SolveLogEntry = {
  id: string;
  timestamp: string;
  status: "ok" | "failed";
  requestId?: string;
  prompt: string;
  files: Array<{
    filename: string;
    mime_type: string;
    content_base64_length: number;
  }>;
  tripletex_credentials: {
    base_url?: string;
    session_token: "REDACTED";
  };
  result: {
    ok: boolean;
    planner?: "llm";
    plan_status?: string;
    plan_summary?: string;
    error?: string;
  };
  duration_ms: number;
};

export function writeSolveLog(input: {
  runId?: string;
  requestId?: string;
  body: SolveRequestBody;
  result: SolveExecutionResult | { ok: false; error: string };
  durationMs: number;
}): void {
  const timestamp = new Date().toISOString();
  const id = input.runId ?? timestamp.replace(/[:.]/g, "-");
  const directory = resolve(process.cwd(), ".solve-logs");
  mkdirSync(directory, { recursive: true });

  const entry: SolveLogEntry = {
    id,
    timestamp,
    status: input.result.ok ? "ok" : "failed",
    requestId: input.requestId,
    prompt: input.body.prompt,
    files: (input.body.files ?? []).map((file) => ({
      filename: file.filename,
      mime_type: file.mime_type,
      content_base64_length: file.content_base64.length,
    })),
    tripletex_credentials: {
      base_url: input.body.tripletex_credentials?.base_url,
      session_token: "REDACTED",
    },
    result: {
      ok: input.result.ok,
      plan_status:
        "planStatus" in input.result ? input.result.planStatus : undefined,
      plan_summary:
        "planSummary" in input.result ? input.result.planSummary : undefined,
      error: "error" in input.result ? input.result.error : undefined,
    },
    duration_ms: input.durationMs,
  };

  const runDirectory = resolve(directory, "runs", id);
  mkdirSync(runDirectory, { recursive: true });
  writeFileSync(
    resolve(runDirectory, "solve-log.json"),
    JSON.stringify(entry, null, 2),
    "utf8",
  );
}
