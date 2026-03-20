#!/usr/bin/env bash
set -euo pipefail

# curl -sS -X POST "https://cas-counseling-plenty-handle.trycloudflare.com/solve" \
  # --max-time 300 \
#   -H "Content-Type: application/json" \
#   -d '{
#     "prompt": "Create customer Acme AS",
#     "files": [],
#     "tripletex_credentials": {
#       "base_url": "https://kkpqfuj-amager.tripletex.dev/v2",
#       "session_token": "eyJ0b2tlbklkIjoyMTQ3NjI5NzU4LCJ0b2tlbiI6IjU3OTQ4ZTVlLTBjNGUtNDAzNi1iY2NkLWI1MjU5NzVlMjYxYSJ9"
#     }
#   }'

curl -sS -X POST "https://cas-counseling-plenty-handle.trycloudflare.com/solve" \
  --max-time 300 \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Run payroll for Emily Lewis (emily.lewis@example.org) for this month. The base salary is 53400 NOK. Add a one-time bonus of 16900 NOK on top of the base salary.",
    "files": [],
    "tripletex_credentials": {
      "base_url": "https://kkpqfuj-amager.tripletex.dev/v2",
      "session_token": "eyJ0b2tlbklkIjoyMTQ3NjI5NzU4LCJ0b2tlbiI6IjU3OTQ4ZTVlLTBjNGUtNDAzNi1iY2NkLWI1MjU5NzVlMjYxYSJ9"
    }
  }'

# curl -sS -X POST "https://cas-counseling-plenty-handle.trycloudflare.com/solve" \  
  # --max-time 300 \
#   -H "Content-Type: application/json" \
#   -d '{
#     "prompt": "Log 12 hours for Victoria Brown (victoria.brown@example.org) on the activity \"Analyse\" in the project \"Data Migration\" for Greenfield Ltd (org no. 890874185). Hourly rate: 850 NOK/h. Generate a project invoice to the customer based on the logged hours.",
#     "files": [],
#     "tripletex_credentials": {
#       "base_url": "https://kkpqfuj-amager.tripletex.dev/v2",
#       "session_token": "eyJ0b2tlbklkIjoyMTQ3NjI5NzU4LCJ0b2tlbiI6IjU3OTQ4ZTVlLTBjNGUtNDAzNi1iY2NkLWI1MjU5NzVlMjYxYSJ9"
#     }
#   }'

# curl -sS -X POST "https://cas-counseling-plenty-handle.trycloudflare.com/solve" \
  # --max-time 300 \
#   -H "Content-Type: application/json" \
#   -d '{
#     "prompt": "Kunden Bølgekraft AS (org.nr 868461780) har reklamert på fakturaen for \"Nettverksteneste\" (6950 kr ekskl. MVA). Opprett ei fullstendig kreditnota som reverserer heile fakturaen.",
#     "files": [],
#     "tripletex_credentials": {
#       "base_url": "https://kkpqfuj-amager.tripletex.dev/v2",
#       "session_token": "eyJ0b2tlbklkIjoyMTQ3NjI5NzU4LCJ0b2tlbiI6IjU3OTQ4ZTVlLTBjNGUtNDAzNi1iY2NkLWI1MjU5NzVlMjYxYSJ9"
#     }
#   }'
