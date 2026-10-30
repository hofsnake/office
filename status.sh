#!/usr/bin/env bash
# Usage: ./status.sh <slug> <working|waiting|error|done|idle> "short generic line"
# Needs OFFICE_PASSWORD in the environment.
# Posts to the live hosted office (Supabase Edge Function) by default.
# OFFICE_URL overrides the target: a URL ending in /functions/v1/office is treated as hosted; anything else (e.g. http://localhost:8787) as the local server.
set -euo pipefail
slug="${1:?slug}"; state="${2:?state}"; line="${3:-}"
: "${OFFICE_PASSWORD:?OFFICE_PASSWORD not set}"
url="${OFFICE_URL:-https://zfwgucpkekllkpzvykwh.supabase.co/functions/v1/office}"
body=$(SLUG="$slug" STATE="$state" LINE="$line" node -e 'console.log(JSON.stringify({slug:process.env.SLUG,state:process.env.STATE,line:process.env.LINE}))')
# credentials passed via curl config on a pipe so the password never appears in argv
if [[ "$url" == */functions/v1/office* ]]; then
  curl -sS --max-time 15 -K <(printf 'header = "x-office-password: %s"\n' "$OFFICE_PASSWORD") -H 'Content-Type: application/json' -d "$body" "${url%/}/status"
else
  curl -sS --max-time 10 -K <(printf 'user = ":%s"\n' "$OFFICE_PASSWORD") -H 'Content-Type: application/json' -d "$body" "$url/api/status"
fi
echo
