#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const endpoint = getArgValue(args, "--url") ?? "http://127.0.0.1:8000/solve";
const iterations = Number(getArgValue(args, "--iterations") ?? "3");
const maxPrompts = Number(getArgValue(args, "--max-prompts") ?? "16");
const basePromptsFile = getArgValue(args, "--base-prompts-file") ?? "test-prompts.example.json";

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error("--iterations must be a positive number");
}
if (!Number.isFinite(maxPrompts) || maxPrompts <= 0) {
  throw new Error("--max-prompts must be a positive number");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const rootDir = resolve(process.cwd(), "reports", "autopilot", stamp);
mkdirSync(rootDir, { recursive: true });

const basePrompts = readPromptsFile(resolve(process.cwd(), basePromptsFile));
let currentPrompts = dedupePrompts([...basePrompts, ...defaultExpansionPrompts()]).slice(0, maxPrompts);
const iterationSummaries = [];

console.log(`Autopilot started: ${iterations} iteration(s), endpoint=${endpoint}`);
console.log(`Workspace: ${rootDir}`);
console.log("");

for (let i = 1; i <= iterations; i += 1) {
  const iterDir = resolve(rootDir, `iter-${i}`);
  mkdirSync(iterDir, { recursive: true });

  const promptsPath = resolve(iterDir, "prompts.json");
  const resultsPath = resolve(iterDir, "results.json");
  const reportPath = resolve(iterDir, "failure-report.json");
  writeFileSync(promptsPath, JSON.stringify(currentPrompts, null, 2), "utf8");

  console.log(`Iteration ${i}/${iterations}: running ${currentPrompts.length} prompts`);
  const runArgs = [
    "scripts/test-solve.mjs",
    "--url",
    endpoint,
    "--prompts-file",
    promptsPath,
    "--output-json",
    resultsPath,
  ];
  const run = spawnSync("node", runArgs, { stdio: "inherit" });
  if (run.status === null) {
    throw new Error(`Failed to execute test-solve in iteration ${i}`);
  }
  if (!existsSync(resultsPath)) {
    throw new Error(`Missing results file for iteration ${i}: ${resultsPath}`);
  }

  const resultsPayload = safeJsonParse(readFileSync(resultsPath, "utf8"));
  const results = Array.isArray(resultsPayload?.results) ? resultsPayload.results : [];
  const failures = results.filter((item) => item?.ok === false);
  const grouped = groupFailures(failures);
  const prioritized = Object.values(grouped).sort((a, b) => b.count - a.count);

  const report = {
    createdAt: new Date().toISOString(),
    endpoint,
    iteration: i,
    totals: {
      total: results.length,
      failed: failures.length,
      passed: results.length - failures.length,
    },
    prioritized,
    rawFailures: failures,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  iterationSummaries.push({
    iteration: i,
    total: results.length,
    failed: failures.length,
    passed: results.length - failures.length,
    reportPath,
  });

  console.log(`Iteration ${i} summary: ${report.totals.passed} passed, ${report.totals.failed} failed`);
  if (prioritized.length > 0) {
    console.log("Top issues:");
    for (const issue of prioritized.slice(0, 3)) {
      console.log(`- ${issue.count}x ${issue.apiMethod} ${issue.apiPath} (field: ${issue.primaryField})`);
    }
  }
  console.log("");

  if (i < iterations) {
    currentPrompts = buildNextPrompts({
      previousPrompts: currentPrompts,
      prioritized,
      maxPrompts,
      iteration: i + 1,
    });
  }
}

const summaryPath = resolve(rootDir, "summary.json");
writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      endpoint,
      iterations,
      maxPrompts,
      basePromptsFile,
      iterationSummaries,
    },
    null,
    2,
  ),
  "utf8",
);

console.log("Autopilot completed.");
console.log(`Summary: ${summaryPath}`);

function buildNextPrompts({ previousPrompts, prioritized, maxPrompts: max, iteration }) {
  const next = [];

  // Keep a small stable baseline each round for regression checks.
  next.push(...previousPrompts.slice(0, Math.min(5, previousPrompts.length)));

  for (const issue of prioritized.slice(0, 5)) {
    next.push(...promptsForIssue(issue, iteration));
  }

  // Add multilingual/randomized expansion each round.
  next.push(...defaultExpansionPrompts(iteration));

  return dedupePrompts(next).slice(0, max);
}

function promptsForIssue(issue, iteration) {
  const suffix = `it${iteration}`;
  const prompts = [];

  if (issue.apiPath === "/employee") {
    prompts.push({
      name: `employee-en-${suffix}`,
      prompt: "Create employee Emma Hansen emma.hansen@example.org",
      files: [],
    });
    prompts.push({
      name: `employee-nb-${suffix}`,
      prompt: "Opprett en ansatt med navn Markus Nilsen, markus.nilsen@example.org",
      files: [],
    });
    prompts.push({
      name: `employee-fr-${suffix}`,
      prompt: "Créer employé Claire Martin claire.martin@example.org",
      files: [],
    });
  }

  if (issue.apiPath === "/order" || issue.apiPath === "/invoice") {
    prompts.push({
      name: `invoice-basic-${suffix}`,
      prompt: "Create invoice for customer Northwind AS amount 950 quantity 1",
      files: [],
    });
    prompts.push({
      name: `invoice-with-dates-${suffix}`,
      prompt: "Create invoice for customer Boreal AS amount 1200 quantity 2 invoiceDate 2026-03-19 dueDate 2026-03-26",
      files: [],
    });
    prompts.push({
      name: `invoice-nb-${suffix}`,
      prompt: "Opprett faktura for kunde Fjell Data AS beløp 1800 antall 3",
      files: [],
    });
  }

  if (issue.apiPath === "/customer") {
    prompts.push({
      name: `customer-en-${suffix}`,
      prompt: "Create customer Riverstone AS",
      files: [],
    });
    prompts.push({
      name: `customer-es-${suffix}`,
      prompt: "Crear cliente Soluciones Norte",
      files: [],
    });
  }

  if (prompts.length === 0) {
    prompts.push({
      name: `generic-${suffix}`,
      prompt: "Create customer Iteration Test AS",
      files: [],
    });
  }

  return prompts;
}

function defaultExpansionPrompts(iteration = 1) {
  return [
    {
      name: `customer-pt-it${iteration}`,
      prompt: "Criar cliente Aurora Tech AS",
      files: [],
    },
    {
      name: `customer-de-it${iteration}`,
      prompt: "Kunde erstellen Nordlicht GmbH",
      files: [],
    },
    {
      name: `invoice-es-it${iteration}`,
      prompt: "Crear factura para cliente Acme AS importe 1400 cantidad 2",
      files: [],
    },
  ];
}

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
    };
    current.count += 1;
    map[key] = current;
  }
  return map;
}

function extractValidationFields(errorText) {
  const jsonStart = errorText.indexOf("{");
  if (jsonStart < 0) {
    return [];
  }
  const payload = safeJsonParse(errorText.slice(jsonStart));
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const messages = Array.isArray(payload.validationMessages) ? payload.validationMessages : [];
  const fields = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }
    const field = typeof message.field === "string" && message.field.trim() ? message.field : undefined;
    const path = typeof message.path === "string" && message.path.trim() ? message.path : undefined;
    fields.push(field ?? path ?? "unknown");
  }
  return fields;
}

function readPromptsFile(pathname) {
  if (!existsSync(pathname)) {
    return [];
  }
  const raw = readFileSync(pathname, "utf8");
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item, index) => {
      if (typeof item === "string") {
        return { name: `base-${index + 1}`, prompt: item, files: [] };
      }
      if (!item || typeof item !== "object" || typeof item.prompt !== "string") {
        return undefined;
      }
      return {
        name: typeof item.name === "string" ? item.name : `base-${index + 1}`,
        prompt: item.prompt,
        files: Array.isArray(item.files) ? item.files : [],
      };
    })
    .filter(Boolean);
}

function dedupePrompts(prompts) {
  const seen = new Set();
  const deduped = [];
  for (const prompt of prompts) {
    const key = prompt.prompt.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(prompt);
  }
  return deduped;
}

function safeJsonParse(value) {
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
