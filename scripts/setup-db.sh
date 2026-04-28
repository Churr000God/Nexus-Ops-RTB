#!/usr/bin/env bash
# =============================================================================
# setup-db.sh — Setup completo de la base de datos Nexus Ops RTB (Supabase)
#
# Hace todo lo necesario para tener la BD lista desde cero:
#   1. Verifica conectividad con Supabase
#   2. Levanta Redis si no está corriendo
#   3. Ejecuta migraciones Alembic (crea tablas si no existen)
#   4. Aplica triggers y funciones (bootstrap_triggers.sql)
#   5. Sincroniza los CSVs (borra datos existentes y recarga desde CSV)
#   6. Crea o actualiza el usuario administrador
#
# Uso:
#   ./scripts/setup-db.sh           # Modo dev (default)
#   ./scripts/setup-db.sh prod      # Modo producción
#
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

MODE="${1:-dev}"

DB_HOST="$(env_get SUPABASE_HOST '')"
DB_NAME="$(env_get POSTGRES_DB postgres)"
DB_USER="$(env_get POSTGRES_USER postgres)"
DB_PASS="$(env_get POSTGRES_PASSWORD '')"
ADMIN_EMAIL="$(env_get ADMIN_EMAIL '')"
ADMIN_PASSWORD="$(env_get ADMIN_PASSWORD '')"
ADMIN_ROLE="$(env_get ADMIN_ROLE admin)"

if [[ -z "$DB_HOST" ]]; then
  err "SUPABASE_HOST no está configurado en .env"
fi

# ---------------------------------------------------------------------------
# 1. Verificar conectividad con Supabase
# ---------------------------------------------------------------------------
log "Paso 1/6 — Verificando conectividad con Supabase ($DB_HOST)..."
wait_for_supabase "$DB_HOST" "$DB_USER" "$DB_PASS" "$DB_NAME" 30

# ---------------------------------------------------------------------------
# 2. Levantar Redis si no está corriendo
# ---------------------------------------------------------------------------
log "Paso 2/6 — Verificando Redis..."
if ! compose_cmd "$MODE" ps redis 2>/dev/null | grep -qE "(Up|running)"; then
  compose_cmd "$MODE" up -d redis
  ok "Redis iniciado."
else
  ok "Redis ya está corriendo."
fi

# ---------------------------------------------------------------------------
# 3. Ejecutar migraciones Alembic
# ---------------------------------------------------------------------------
log "Paso 3/6 — Ejecutando migraciones Alembic..."
MSYS_NO_PATHCONV=1 compose_cmd "$MODE" run --rm -T --no-deps \
  backend \
  alembic upgrade head
ok "Migraciones aplicadas."

# ---------------------------------------------------------------------------
# 4. Aplicar triggers y funciones (bootstrap_triggers.sql)
# ---------------------------------------------------------------------------
log "Paso 4/6 — Aplicando triggers y funciones (bootstrap_triggers.sql)..."
PGPASSWORD="$DB_PASS" psql \
  -h "$DB_HOST" \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f ./scripts/bootstrap_triggers.sql
ok "Triggers y funciones aplicados."

# ---------------------------------------------------------------------------
# 5. Sincronizar datos CSV (borra existentes y recarga)
# ---------------------------------------------------------------------------
log "Paso 5/6 — Sincronizando datos CSV (modo replace)..."
MSYS_NO_PATHCONV=1 compose_cmd "$MODE" run --rm -T --no-deps \
  -e PYTHONPATH=/app \
  backend \
  python /app/scripts/sync_csv_data.py --force
ok "Datos CSV sincronizados."

# ---------------------------------------------------------------------------
# 6. Crear / actualizar usuario administrador
# ---------------------------------------------------------------------------
if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  warn "ADMIN_EMAIL/ADMIN_PASSWORD no configurados. Saltando creación de usuario administrador."
else
  log "Paso 6/6 — Creando usuario administrador ($ADMIN_EMAIL)..."
  MSYS_NO_PATHCONV=1 compose_cmd "$MODE" run --rm -T --no-deps \
    -e PYTHONPATH=/app \
    backend \
    python /app/scripts/create_admin_user.py \
      --email "$ADMIN_EMAIL" \
      --password "$ADMIN_PASSWORD" \
      --role "$ADMIN_ROLE"
  ok "Usuario administrador listo."
fi

ok "============================================================"
ok " Setup completado exitosamente."
ok " BD: $DB_NAME @ $DB_HOST"
ok "============================================================"
