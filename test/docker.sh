#!/usr/bin/env bash
# Run test/run.sh locally the way CI does: a Document Server reachable as documentserver and a
# node:24 container on one Docker network. DS_IMAGE selects another Document Server image.
set -euo pipefail
cd "$(dirname "$0")/.."

DS_IMAGE=${DS_IMAGE:-onlyoffice/documentserver-de:latest}
NETWORK=onlyoffice-n8n-tests
DS=onlyoffice-n8n-tests-ds

docker network create "$NETWORK" >/dev/null 2>&1 || true
docker rm --force "$DS" >/dev/null 2>&1 || true
docker run --detach --name "$DS" --network "$NETWORK" --network-alias documentserver \
  --env JWT_SECRET=automation-secret-0123456789abcdef0123 --env ALLOW_PRIVATE_IP_ADDRESS=true \
  "$DS_IMAGE" >/dev/null
trap 'docker rm --force "$DS" >/dev/null' EXIT

# The repository is copied into the container so that node_modules is built for Linux.
# MSYS_NO_PATHCONV and cygpath keep the paths intact in Git Bash on Windows.
MSYS_NO_PATHCONV=1 docker run --rm --network "$NETWORK" \
  --volume "$(cygpath -m "$PWD" 2>/dev/null || pwd):/src:ro" \
  --volume onlyoffice-n8n-tests-npm:/root/.npm \
  node:24-bookworm bash -c \
  'mkdir /work && tar -C /src --exclude=./node_modules --exclude=./dist -cf - . | tar -C /work -xf - && bash /work/test/run.sh'
