#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TUNNEL_URL:-}" ]]; then
  echo "TUNNEL_URL is required, for example: TUNNEL_URL=https://example.trycloudflare.com npm run cloudflare:test" >&2
  exit 1
fi

curl -sS -X POST "${TUNNEL_URL%/}/solve" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create customer Acme AS",
    "files": [],
    "tripletex_credentials": {
      "base_url": "https://kkpqfuj-amager.tripletex.dev/v2",
      "session_token": "eyJ0b2tlbklkIjoyMTQ3NjI5NzU4LCJ0b2tlbiI6IjU3OTQ4ZTVlLTBjNGUtNDAzNi1iY2NkLWI1MjU5NzVlMjYxYSJ9"
    }
  }'
