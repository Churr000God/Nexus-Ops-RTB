#!/usr/bin/env bash
# =============================================================================
# backup-db.sh — Backup de la base de datos PostgreSQL
# Uso:
#   ./scripts/backup-db.sh                    # Backup con timestamp
#   ./scripts/backup-db.sh nombre_custom      # Backup con nombre personalizado
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

# --- Configuración ---
BACKUP_DIR="data/backups"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_NAME="${1:-nexus_ops_backup_$TIMESTAMP}"
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql.gz"
MAX_BACKUPS="${MAX_BACKUPS:-10}"
MODE="${2:-dev}"
SERVICE="$(postgres_service_name)"

# --- Verificaciones ---
mkdir -p "$BACKUP_DIR"

if ! compose_cmd "$MODE" ps "$SERVICE" >/dev/null 2>&1; then
  err "Servicio $SERVICE no disponible en modo $MODE."
fi
if ! compose_cmd "$MODE" ps "$SERVICE" | grep -q "Up"; then
  err "Servicio $SERVICE no está corriendo en modo $MODE."
  exit 1
fi

# --- Backup ---
log "Creando backup: $BACKUP_FILE"

DB_NAME="$(env_get POSTGRES_DB nexus_ops)"
DB_USER="$(env_get POSTGRES_USER nexus)"

compose_cmd "$MODE" exec -T "$SERVICE" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
ok "Backup creado: $BACKUP_FILE ($SIZE)"

# --- Rotación: eliminar backups antiguos ---
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
if [[ $BACKUP_COUNT -gt $MAX_BACKUPS ]]; then
  EXCESS=$((BACKUP_COUNT - MAX_BACKUPS))
  log "Eliminando $EXCESS backup(s) antiguo(s)..."
  ls -1t "$BACKUP_DIR"/*.sql.gz | tail -n "$EXCESS" | xargs rm -f
  ok "Rotación completada. Se mantienen los últimos $MAX_BACKUPS backups."
fi
