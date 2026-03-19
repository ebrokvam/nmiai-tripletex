#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile();

const args = process.argv.slice(2);
const endpoint = getArgValue(args, "--url") ?? "http://127.0.0.1:8000/solve";
const promptsFile = getArgValue(args, "--prompts-file");
const inlinePrompts = getRepeatedArgValues(args, "--prompt");
const outputJsonPath = getArgValue(args, "--output-json");

const testCases = loadTestCases({ promptsFile, inlinePrompts });
if (testCases.length === 0) {
  console.error("No prompts found. Use --prompt or --prompts-file.");
  process.exit(1);
}

const defaultCreds = getDefaultTripletexCredentials();
const startedAt = Date.now();
const results = [];

for (let i = 0; i < testCases.length; i += 1) {
  const test = testCases[i];
  const body = {
    prompt: test.prompt,
    files: test.files ?? [],
    tripletex_credentials: test.tripletex_credentials ?? defaultCreds,
  };

  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const parsed = tryParseJson(text);
    const debug = extractDebug(parsed);
    const logicalOk = response.ok && (debug ? debug.ok === true : true);
    const elapsedMs = Date.now() - started;

    results.push({
      name: test.name ?? `prompt-${i + 1}`,
      prompt: test.prompt,
      ok: logicalOk,
      status: response.status,
      elapsedMs,
      responseText: text,
      responseJson: parsed,
      debug,
      error: undefined,
    });
  } catch (error) {
    const elapsedMs = Date.now() - started;
    results.push({
      name: test.name ?? `prompt-${i + 1}`,
      prompt: test.prompt,
      ok: false,
      status: undefined,
      elapsedMs,
      responseText: undefined,
      responseJson: undefined,
      debug: undefined,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const totalMs = Date.now() - startedAt;
printResults({ endpoint, results, totalMs });
writeJsonOutputIfRequested({ endpoint, results, totalMs, outputJsonPath });

const failed = results.filter((result) => !result.ok).length;
process.exit(failed > 0 ? 1 : 0);

function loadTestCases({ promptsFile, inlinePrompts }) {
  if (inlinePrompts.length > 0) {
    return inlinePrompts.map((prompt, index) => ({
      name: `inline-${index + 1}`,
      prompt,
      files: [],
    }));
  }

  if (!promptsFile) {
    return defaultCases();
  }

  const absolutePath = resolve(process.cwd(), promptsFile);
  if (!existsSync(absolutePath)) {
    throw new Error(`Prompts file not found: ${absolutePath}`);
  }

  const raw = readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Prompts file must be a JSON array.");
  }

  return parsed.map((item, index) => {
    if (typeof item === "string") {
      return { name: `file-${index + 1}`, prompt: item, files: [] };
    }

    if (!item || typeof item !== "object" || typeof item.prompt !== "string") {
      throw new Error(`Invalid prompt entry at index ${index}.`);
    }

    return {
      name: typeof item.name === "string" ? item.name : `file-${index + 1}`,
      prompt: item.prompt,
      files: Array.isArray(item.files) ? item.files : [],
      tripletex_credentials:
        item.tripletex_credentials &&
        typeof item.tripletex_credentials.base_url === "string" &&
        typeof item.tripletex_credentials.session_token === "string"
          ? item.tripletex_credentials
          : undefined,
    };
  });
}

function defaultCases() {
  return [
    { name: "create-customer", prompt: "Create customer Acme AS", files: [] },
    { name: "create-employee", prompt: "Create employee Ola Nordmann ola@example.org", files: [] },
    {
      name: "create-invoice",
      prompt: "Create invoice for customer Acme AS amount 1200 quantity 2",
      files: [],
    },
  ];
}

function getDefaultTripletexCredentials() {
  const baseUrl = process.env.TRIPLETEX_BASE_URL;
  const sessionToken = process.env.TRIPLETEX_SESSION_TOKEN;

  if (!baseUrl || !sessionToken) {
    return undefined;
  }

  return {
    base_url: baseUrl,
    session_token: sessionToken,
  };
}

function printResults({ endpoint, results, totalMs }) {
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Ran ${results.length} prompt(s) in ${totalMs} ms`);
  console.log("");

  for (const result of results) {
    const statusLabel = result.status === undefined ? "NO_RESPONSE" : String(result.status);
    const pass = result.ok ? "OK" : "FAIL";
    console.log(`[${pass}] ${result.name} (${statusLabel}, ${result.elapsedMs} ms)`);
    console.log(`  prompt: ${result.prompt}`);
    if (result.error) {
      console.log(`  error: ${result.error}`);
    } else if (result.debug) {
      console.log(`  debug: ${JSON.stringify(result.debug)}`);
    } else if (result.responseJson !== undefined) {
      console.log(`  response: ${JSON.stringify(result.responseJson)}`);
    } else if (result.responseText !== undefined) {
      console.log(`  response: ${result.responseText}`);
    }
    console.log("");
  }

  const successCount = results.filter((item) => item.ok).length;
  const failCount = results.length - successCount;
  console.log(`Summary: ${successCount} ok, ${failCount} failed`);
}

function extractDebug(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }
  if (!("debug" in parsed)) {
    return undefined;
  }
  const value = parsed.debug;
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value;
}

function getArgValue(argsList, flag) {
  const index = argsList.indexOf(flag);
  if (index < 0 || index + 1 >= argsList.length) {
    return undefined;
  }
  return argsList[index + 1];
}

function getRepeatedArgValues(argsList, flag) {
  const values = [];
  for (let i = 0; i < argsList.length; i += 1) {
    if (argsList[i] === flag && i + 1 < argsList.length) {
      values.push(argsList[i + 1]);
      i += 1;
    }
  }
  return values;
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function writeJsonOutputIfRequested({ endpoint: target, results: allResults, totalMs: durationMs, outputJsonPath: outputPath }) {
  if (!outputPath) {
    return;
  }

  const absolutePath = resolve(process.cwd(), outputPath);
  const payload = {
    endpoint: target,
    totalMs: durationMs,
    timestamp: new Date().toISOString(),
    results: allResults,
  };

  const dir = resolve(absolutePath, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(absolutePath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote JSON results to ${absolutePath}`);
}
