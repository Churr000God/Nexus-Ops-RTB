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

# --- Configuración ---
BACKUP_DIR="data/backups"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_NAME="${1:-nexus_ops_backup_$TIMESTAMP}"
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql.gz"
CONTAINER="nexus-ops-rtb-postgres-1"
MAX_BACKUPS="${MAX_BACKUPS:-10}"

# --- Verificaciones ---
mkdir -p "$BACKUP_DIR"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  err "Contenedor $CONTAINER no encontrado. Asegúrate de que el stack esté corriendo."
fi

# --- Backup ---
log "Creando backup: $BACKUP_FILE"

# Leer credenciales del .env
DB_NAME=$(grep -E '^POSTGRES_DB=' .env | cut -d'=' -f2 || echo "nexus_ops")
DB_USER=$(grep -E '^POSTGRES_USER=' .env | cut -d'=' -f2 || echo "nexus")

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

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
