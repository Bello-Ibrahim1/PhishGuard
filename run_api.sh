#!/usr/bin/env bash
# Run PhishGuard API from project root. No need to cd into sentinel.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if [ -d "venv" ]; then
  source venv/bin/activate
else
  echo "Create venv first: python3 -m venv venv && source venv/bin/activate && pip install -r sentinel/requirements.txt"
  exit 1
fi
exec python -m uvicorn sentinel.main:app --reload --host 0.0.0.0 --port 8000
