#!/usr/bin/env bash
# Run all tests: unit tests, then the automation tests against the Document Server at
# $DS_URL (default http://documentserver). CI runs this script in a node:24 container;
# test/docker.sh runs it the same way locally.
set -euo pipefail
cd "$(dirname "$0")/.."

N8N_VERSION=2.40.7
PNPM_VERSION=$(sed -n 's/^pnpm = "\(.*\)"/\1/p' mise.toml)

npm install --global --no-fund --no-audit --loglevel=error "pnpm@$PNPM_VERSION" >/dev/null
pnpm install --frozen-lockfile
pnpm test

npm install --global --no-fund --no-audit --loglevel=error "n8n@$N8N_VERSION" >/dev/null
pnpm build
pnpm test:automation
