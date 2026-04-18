#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

BRANCH="${1:-${PULL_BRANCH:-main}}"
DO_STASH="${AUTO_STASH:-true}"
STASHED="false"

if [[ -n "$(git status --porcelain)" && "$DO_STASH" == "true" ]]; then
  git stash push -u -m "auto-stash-$(date -u +%Y%m%d-%H%M%S)" >/dev/null
  STASHED="true"
fi

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [[ "$STASHED" == "true" ]]; then
  set +e
  git stash pop >/dev/null
  POP_CODE=$?
  set -e
  if [[ $POP_CODE -ne 0 ]]; then
    echo "Se aplicó el pull, pero hubo conflicto al re-aplicar el stash. El stash se mantiene para resolución manual." >&2
    exit 2
  fi
fi
