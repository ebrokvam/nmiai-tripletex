# NMIAI Tripletex Agent Starter (TypeScript)

Minimal Node.js starter for the Tripletex challenge with a clean architecture split:

- `src/api` — transport layer (`/solve`, `/health`)
- `src/core` — planner + executor
- `src/tripletex` — API client and request wrappers
- `src/types` — request/response and domain types

## Quick start

```bash
npm install
cp .env.example .env
# run codex login in this environment
npm run dev
```

Server starts at `http://localhost:8000`.

## LLM Planner (recommended)

This project now supports a two-stage Codex SDK flow:
1. LLM parsing/planning to normalize the prompt into a structured task guess.
2. LLM execution in iterative tool steps against Tripletex API endpoints.

Set environment variables in `.env` (recommended):

```env
# local testing credentials used by test scripts
TRIPLETEX_BASE_URL=https://tx-proxy.ainm.no/v2
TRIPLETEX_SESSION_TOKEN=...
```

Authenticate Codex in the same environment (`codex login`) before starting the server.

`/solve` includes a local debug object:

```json
{
  "status": "completed",
  "debug": {
    "ok": false,
    "planner": "llm",
    "plan_status": "planned",
    "plan_summary": "Create and send an invoice for the requested customer",
    "error": "Tripletex POST /order failed ..."
  }
}
```

## Solve Run Logs

Each `/solve` request is persisted locally with redacted credentials:

- `.solve-logs/runs/<timestamp>/codex-transcript.md`
- `.solve-logs/runs/<timestamp>/solve-log.json`
- `.solve-logs/runs/<timestamp>/http-requests.json`

Stored fields include prompt, planning status/summary, success/failure, error message, duration, and all HTTP requests made during the run. JSON request and response bodies are pretty-printed into the consolidated HTTP log when possible.
The folder is fixed to `.solve-logs` in the project root.

## Test Runner

Use the local test runner instead of manual curl commands.

Run default prompts:

```bash
npm run test:solve
```

Run with inline prompts:

```bash
npm run test:solve -- --prompt "Create customer Acme AS" --prompt "Create employee Ola Nordmann ola@example.org"
```

Run from file:

```bash
npm run test:solve -- --prompts-file test-prompts.example.json
```

Optional custom endpoint:

```bash
npm run test:solve -- --url https://your-tunnel.trycloudflare.com/solve --prompts-file test-prompts.example.json
```

## Failure Analyzer

Run prompts and automatically group failures by Tripletex endpoint and validation field:

```bash
npm run analyze:solve -- --prompts-file test-prompts.example.json
```

Optional endpoint override:

```bash
npm run analyze:solve -- --url https://your-tunnel.trycloudflare.com/solve --prompts-file test-prompts.example.json
```

Reports are written to `reports/` as JSON with prioritized fix suggestions.

## Autopilot Loop

Run iterative solve -> analyze -> prompt-expansion loops automatically:

```bash
npm run autopilot:solve -- --iterations 3 --prompts-file test-prompts.example.json
```

Optional flags:

```bash
npm run autopilot:solve -- --url http://127.0.0.1:8000/solve --iterations 5 --max-prompts 20 --base-prompts-file test-prompts.example.json
```

Outputs are written to `reports/autopilot/<timestamp>/` with one folder per iteration:
- `prompts.json`
- `results.json`
- `failure-report.json`
- final `summary.json`

## Playbook Evaluation

Run fixture-based evaluation by task family:

```bash
npm run eval:playbook
```

Optional custom fixture file:

```bash
npm run eval:playbook -- --fixtures-file fixtures/playbook-fixtures.json
```

## Endpoint

### `POST /solve`

Expected body:

```json
{
  "prompt": "Opprett en ansatt med navn Ola Nordmann, ola@example.org",
  "files": [],
  "tripletex_credentials": {
    "base_url": "https://tx-proxy.ainm.no/v2",
    "session_token": "..."
  }
}
```

Returns:

```json
{ "status": "completed" }
```

## Current coverage

Execution is tool-driven: the planner returns a generic, open-ended plan and the execution agent performs Tripletex API actions through tools.

## Production notes

- Keep `/solve` within the 300 second timeout
- Minimize trial-and-error API calls to improve efficiency score
- Add structured run logging and idempotency keys as you expand
- Use LLM planning plus tool-based execution, and fail closed when planning/execution is uncertain
