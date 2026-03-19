#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const endpoint = getArgValue(args, "--url") ?? "http://127.0.0.1:8000/solve";
const promptsFile = getArgValue(args, "--prompts-file") ?? "test-prompts.example.json";
const reportDir = resolve(process.cwd(), "reports");
mkdirSync(reportDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const resultsPath = resolve(reportDir, `solve-results-${stamp}.json`);
const reportPath = resolve(reportDir, `failure-report-${stamp}.json`);

const runArgs = [
  "scripts/test-solve.mjs",
  "--url",
  endpoint,
  "--prompts-file",
  promptsFile,
  "--output-json",
  resultsPath,
];

const run = spawnSync("node", runArgs, { stdio: "inherit" });
if (run.status === null) {
  console.error("Failed running test-solve.");
  process.exit(1);
}

if (!existsSync(resultsPath)) {
  console.error(`Expected results file not found: ${resultsPath}`);
  process.exit(1);
}

const raw = readFileSync(resultsPath, "utf8");
const parsed = JSON.parse(raw);
const results = Array.isArray(parsed.results) ? parsed.results : [];

const failures = results.filter((item) => item?.ok === false);
const grouped = groupFailures(failures);
const prioritized = Object.values(grouped).sort((a, b) => b.count - a.count);

const report = {
  createdAt: new Date().toISOString(),
  endpoint,
  promptsFile,
  totals: {
    total: results.length,
    failed: failures.length,
    passed: results.length - failures.length,
  },
  prioritized,
  rawFailures: failures,
  sourceResultsFile: resultsPath,
};

writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
printSummary(report, reportPath);

process.exit(failures.length > 0 ? 1 : 0);

function groupFailures(failuresList) {
  const map = {};

  for (const failure of failuresList) {
    const debugError =
      typeof failure?.debug?.error === "string"
        ? failure.debug.error
        : typeof failure?.error === "string"
          ? failure.error
          : "Unknown error";

    const endpointMatch = debugError.match(/Tripletex\s+(GET|POST|PUT|DELETE)\s+([^\s]+)\s+failed/i);
    const apiMethod = endpointMatch?.[1]?.toUpperCase() ?? "UNKNOWN";
    const apiPath = endpointMatch?.[2] ?? "unknown";

    const validationFields = extractValidationFields(debugError);
    const primaryField = validationFields[0] ?? "unknown";

    const key = `${apiMethod} ${apiPath} :: ${primaryField}`;
    const current = map[key] ?? {
      key,
      apiMethod,
      apiPath,
      primaryField,
      count: 0,
      examples: [],
      plannerKinds: {},
      recommendedAction: recommendationFor(apiPath, primaryField),
    };

    current.count += 1;
    current.examples.push({
      name: failure.name,
      prompt: failure.prompt,
      error: debugError,
    });

    const kind = failure?.debug?.kind ?? "unknown";
    current.plannerKinds[kind] = (current.plannerKinds[kind] ?? 0) + 1;

    map[key] = current;
  }

  return map;
}

function extractValidationFields(errorText) {
  const jsonStart = errorText.indexOf("{");
  if (jsonStart < 0) {
    return [];
  }

  const payload = tryParseJson(errorText.slice(jsonStart));
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const messages = Array.isArray(payload.validationMessages) ? payload.validationMessages : [];
  const fields = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      continue;
    }
    const field = typeof msg.field === "string" && msg.field.trim() ? msg.field : undefined;
    const path = typeof msg.path === "string" && msg.path.trim() ? msg.path : undefined;
    fields.push(field ?? path ?? "unknown");
  }
  return fields;
}

function recommendationFor(apiPath, field) {
  if (apiPath === "/employee" && field.toLowerCase().includes("usertype")) {
    return "Set Employee.userType explicitly (STANDARD/EXTENDED/NO_ACCESS).";
  }
  if (apiPath === "/order" && field.toLowerCase().includes("deliverydate")) {
    return "Include Order.deliveryDate in createOrder payload.";
  }
  if (field !== "unknown") {
    return `Add pre-validation and payload mapping for field '${field}'.`;
  }
  return "Inspect validationMessages and add deterministic payload rule.";
}

function printSummary(report, reportPathname) {
  console.log("");
  console.log("Failure Analysis");
  console.log(`- Total: ${report.totals.total}`);
  console.log(`- Passed: ${report.totals.passed}`);
  console.log(`- Failed: ${report.totals.failed}`);
  console.log("");

  if (report.prioritized.length === 0) {
    console.log("No failures to analyze.");
    console.log(`Report: ${reportPathname}`);
    return;
  }

  console.log("Prioritized issues:");
  for (const item of report.prioritized) {
    console.log(`- ${item.count}x ${item.apiMethod} ${item.apiPath} (field: ${item.primaryField})`);
    console.log(`  action: ${item.recommendedAction}`);
  }
  console.log("");
  console.log(`Report: ${reportPathname}`);
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getArgValue(argsList, flag) {
  const index = argsList.indexOf(flag);
  if (index < 0 || index + 1 >= argsList.length) {
    return undefined;
  }
  return argsList[index + 1];
}
