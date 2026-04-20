#!/usr/bin/env bash
# =============================================================================
# restore-db.sh — Restaurar backup de PostgreSQL
# Uso:  ./scripts/restore-db.sh data/backups/nexus_ops_backup_20260418.sql.gz
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

BACKUP_FILE="${1:-}"
MODE="${2:-dev}"
AUTO_CONFIRM="${AUTO_CONFIRM:-false}"
SERVICE="$(postgres_service_name)"

if [[ -z "$BACKUP_FILE" ]]; then
  log "Backups disponibles:"
  ls -1t data/backups/*.sql.gz 2>/dev/null || echo "  (ninguno)"
  echo ""
  err "Uso: ./scripts/restore-db.sh <ruta_backup>"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  err "Archivo no encontrado: $BACKUP_FILE"
fi

DB_NAME="$(env_get POSTGRES_DB nexus_ops)"
DB_USER="$(env_get POSTGRES_USER nexus)"

warn "Esto reemplazará TODOS los datos de la base de datos '$DB_NAME'."
if [[ "$AUTO_CONFIRM" != "true" ]]; then
  read -r -p "Continuar? (y/N): " CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    log "Restauración cancelada."
    exit 0
  fi
else
  warn "AUTO_CONFIRM=true detectado. Continuando sin prompt."
fi

log "Creando backup de seguridad antes de restaurar..."
bash ./scripts/backup-db.sh "pre_restore_$(date -u +%Y%m%d_%H%M%S)" "$MODE"

log "Restaurando desde: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | compose_cmd "$MODE" exec -T "$SERVICE" psql -U "$DB_USER" -d "$DB_NAME" --single-transaction

ok "Base de datos restaurada exitosamente."
