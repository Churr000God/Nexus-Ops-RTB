#!/usr/bin/env bash
# =============================================================================
# backup-db.sh — Backup de la base de datos en Supabase
# Uso:
#   ./scripts/backup-db.sh                    # Backup con timestamp
#   ./scripts/backup-db.sh nombre_custom      # Backup con nombre personalizado
# Requiere: pg_dump instalado localmente
# =============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

source ./scripts/lib/common.sh

require pg_dump
require_env_file

# --- Configuración ---
BACKUP_DIR="data/backups"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_NAME="${1:-nexus_ops_backup_$TIMESTAMP}"
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql.gz"
MAX_BACKUPS="${MAX_BACKUPS:-10}"

DB_HOST="$(env_get SUPABASE_HOST '')"
DB_PORT="$(env_get SUPABASE_PORT 6543)"
DB_NAME="$(env_get POSTGRES_DB postgres)"
DB_USER="$(env_get POSTGRES_USER postgres)"
DB_PASS="$(env_get POSTGRES_PASSWORD '')"

if [[ -z "$DB_HOST" ]]; then
  err "SUPABASE_HOST no está configurado en .env"
fi

# --- Backup ---
mkdir -p "$BACKUP_DIR"
log "Creando backup: $BACKUP_FILE"

PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl | gzip > "$BACKUP_FILE"

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
