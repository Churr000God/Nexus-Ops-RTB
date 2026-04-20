#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

source ./scripts/lib/common.sh
require docker

MODE="${1:-dev}"
case "$MODE" in
  dev|prod|production) ;;
  *) err "Modo inválido: $MODE. Usa: dev|prod" ;;
esac

compose_cmd "$MODE" down
ok "Stack $MODE detenido (volúmenes preservados)."

