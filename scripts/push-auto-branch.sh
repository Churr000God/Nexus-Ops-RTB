#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

MSG="${1:-}"
BASE_BRANCH="${2:-${BASE_BRANCH:-main}}"
PREFIX="${BRANCH_PREFIX:-auto}"

if [[ -z "$MSG" ]]; then
  MSG="chore: auto update $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

USER_RAW="$(id -un 2>/dev/null || echo user)"
USER_SAFE="$(echo "$USER_RAW" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9._-')"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BRANCH="${PREFIX}/${USER_SAFE}/${STAMP}"

git fetch origin

if [[ -z "$(git status --porcelain)" ]]; then
  git checkout "$BASE_BRANCH"
  git pull --ff-only origin "$BASE_BRANCH"
fi

git checkout -b "$BRANCH"
git add -A

if git diff --cached --quiet; then
  echo "No hay cambios para commitear."
  exit 0
fi

git commit -m "$MSG"
git push -u origin "$BRANCH"
