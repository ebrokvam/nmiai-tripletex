import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const baseUrl = process.env.TRIPLETEX_BASE_URL;
const sessionToken = process.env.TRIPLETEX_SESSION_TOKEN;
const logFile = process.env.TRIPLETEX_HTTP_LOG_FILE;

if (!baseUrl) {
  throw new Error("TRIPLETEX_BASE_URL is required");
}

if (!sessionToken) {
  throw new Error("TRIPLETEX_SESSION_TOKEN is required");
}

const server = new McpServer({
  name: "tripletex-local",
  version: "1.0.0",
});

server.registerTool(
  "tripletex_request",
  {
    title: "Tripletex Request",
    description:
      "Make an authenticated JSON request against the configured Tripletex API base URL.",
    inputSchema: {
      method: z
        .enum(["GET", "POST", "PUT", "DELETE"])
        .describe("HTTP method"),
      path: z
        .string()
        .min(1)
        .describe("API path starting with /, for example /customer"),
      query: z
        .record(z.string(), z.union([z.string(), z.array(z.string())]))
        .optional()
        .describe("Optional query parameters"),
      body: z.unknown().optional().describe("Optional JSON request body"),
    },
  },
  async ({ method, path, query, body }) => {
    if (!path.startsWith("/")) {
      throw new Error("path must start with '/'");
    }

    const url = buildUrl(baseUrl, path, query);
    const authHeader = `Basic ${Buffer.from(`0:${sessionToken}`).toString("base64")}`;

    let response;
    let responseText = "";
    let networkError;

    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      responseText = await response.text();
    } catch (error) {
      networkError =
        error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
    }

    const parsedBody = parseJsonIfPossible(responseText);
    const result = {
      ok: response?.ok ?? false,
      status: response?.status ?? null,
      statusText: response?.statusText ?? null,
      method,
      path,
      query: query ?? null,
      url,
      body: parsedBody,
      error: networkError ?? null,
    };

    appendHttpLog({
      started_at: new Date().toISOString(),
      method,
      path,
      query: query ?? null,
      url,
      status: result.status,
      ok: result.ok,
      response_body: parsedBody,
      error: result.error,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
      isError: false,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

function buildUrl(base, path, query) {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const url = new URL(path.replace(/^\//, ""), normalizedBase);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, item);
      }
      continue;
    }

    url.searchParams.set(key, value);
  }

  return url.toString();
}

function parseJsonIfPossible(value) {
  if (!value) {
    return "";
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function appendHttpLog(entry) {
  if (!logFile) {
    return;
  }

  const resolvedLogFile = resolve(logFile);
  mkdirSync(dirname(resolvedLogFile), { recursive: true });

  const existing = existsSync(resolvedLogFile)
    ? parseExistingLog(resolvedLogFile)
    : [];

  existing.push(entry);
  writeFileSync(resolvedLogFile, JSON.stringify(existing, null, 2), "utf8");
}

function parseExistingLog(logPath) {
  try {
    const parsed = JSON.parse(readFileSync(logPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
