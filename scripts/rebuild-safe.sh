#!/usr/bin/env bash
# =============================================================================
# rebuild-safe.sh — Rebuild seguro sin perder datos
# La BD está en Supabase (externa), no se ve afectada por el rebuild.
# Uso:
#   ./scripts/rebuild-safe.sh              # dev
#   ./scripts/rebuild-safe.sh prod         # prod
#   ./scripts/rebuild-safe.sh dev --force  # rebuild sin cache
# =============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

source ./scripts/lib/common.sh
require docker
require_env_file

MODE="${1:-dev}"
FORCE="${2:-}"

case "$MODE" in
  dev|prod|production) ;;
  *) err "Modo inválido: $MODE. Usa: dev|prod" ;;
esac
if [[ "$MODE" == "production" ]]; then
  MODE="prod"
fi

log "Backup de seguridad previo a rebuild..."
bash ./scripts/backup-db.sh "pre_rebuild_$(date -u +%Y%m%d_%H%M%S)" || warn "No se pudo crear backup previo."

log "Rebuild de imágenes..."
if [[ "$FORCE" == "--force" ]]; then
  compose_cmd "$MODE" build --no-cache
else
  compose_cmd "$MODE" build
fi

log "Recreando contenedores sin eliminar volúmenes..."
compose_cmd "$MODE" up -d --force-recreate --remove-orphans

bash ./scripts/health-check.sh "$MODE" || warn "Servicios levantados con advertencias de health-check."
ok "Rebuild seguro completado en modo $MODE."
