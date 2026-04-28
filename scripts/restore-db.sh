#!/usr/bin/env bash
# =============================================================================
# restore-db.sh — Restaurar backup de PostgreSQL en Supabase
# Uso:  ./scripts/restore-db.sh [archivo.sql.gz]
# Requiere: psql instalado localmente
# =============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

source ./scripts/lib/common.sh

require psql
require_env_file

BACKUP_FILE="${1:-}"
AUTO_CONFIRM="${AUTO_CONFIRM:-false}"

DB_HOST="$(env_get SUPABASE_HOST '')"
DB_PORT="$(env_get SUPABASE_PORT 6543)"
DB_NAME="$(env_get POSTGRES_DB postgres)"
DB_USER="$(env_get POSTGRES_USER postgres)"
DB_PASS="$(env_get POSTGRES_PASSWORD '')"

if [[ -z "$DB_HOST" ]]; then
  err "SUPABASE_HOST no está configurado en .env"
fi

if [[ -z "$BACKUP_FILE" ]]; then
  LATEST="$(ls -1t data/backups/*.sql.gz 2>/dev/null | head -n 1 || true)"
  if [[ -z "$LATEST" ]]; then
    log "Backups disponibles:"
    echo "  (ninguno)"
    err "No hay backups en data/backups/. Usa: ./scripts/backup-db.sh primero."
  fi
  log "Backups disponibles (más reciente primero):"
  ls -1t data/backups/*.sql.gz
  echo ""
  log "Usando el más reciente: $LATEST"
  BACKUP_FILE="$LATEST"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  err "Archivo no encontrado: $BACKUP_FILE"
fi

warn "Esto limpiará el schema 'public' y restaurará todos los datos."
warn "  Backup: $BACKUP_FILE"
warn "  BD: $DB_NAME @ $DB_HOST"
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
bash ./scripts/backup-db.sh "pre_restore_$(date -u +%Y%m%d_%H%M%S)"

log "Limpiando schema público en Supabase..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null

log "Restaurando desde: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASS" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --single-transaction >/dev/null

ok "Base de datos restaurada exitosamente."
