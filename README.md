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
# edit .env and set OPENAI_API_KEY
npm run dev
```

Server starts at `http://localhost:8000`.

## LLM Planner (recommended)

This project now supports an OpenAI-based planner for multilingual prompt interpretation.
Execution remains deterministic in handler code.

Set environment variables in `.env` (recommended):

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
OPENAI_BASE_URL=https://api.openai.com/v1
SOLVER_DEBUG_RESPONSE=true

# optional local testing fallback when request body omits credentials
TRIPLETEX_BASE_URL=https://tx-proxy.ainm.no/v2
TRIPLETEX_SESSION_TOKEN=...
```

If `OPENAI_API_KEY` is missing or the LLM call fails, the server falls back to rule-based parsing.
The server logs why LLM fallback happened.

When `SOLVER_DEBUG_RESPONSE=true`, `/solve` includes a local debug object:

```json
{
  "status": "completed",
  "debug": {
    "ok": false,
    "planner": "llm",
    "kind": "create_invoice",
    "error": "Tripletex POST /order failed ..."
  }
}
```

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

This starter includes deterministic handling for:

- create employee (basic patterns)
- create customer (basic patterns)

Everything else currently no-ops but still returns `status: completed`, so you can evolve task coverage incrementally.

## Production notes

- Keep `/solve` within the 300 second timeout
- Minimize trial-and-error API calls to improve efficiency score
- Add structured run logging and idempotency keys as you expand
- Use an LLM planner only for extraction/planning; keep execution deterministic
