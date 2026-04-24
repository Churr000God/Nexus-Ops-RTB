#!/usr/bin/env bash
# =============================================================================
# setup-db.sh — Setup completo de la base de datos Nexus Ops RTB
#
# Hace todo lo necesario para tener la BD lista desde cero:
#   1. Levanta el contenedor postgres si no está corriendo
#   2. Espera a que postgres acepte conexiones
#   3. Crea la base de datos si no existe
#   4. Ejecuta migraciones Alembic (crea tablas si no existen)
#   5. Sincroniza los CSVs (borra datos existentes y recarga desde CSV)
#   6. Crea o actualiza el usuario administrador
#   7. Genera un backup inicial
#
# Uso:
#   ./scripts/setup-db.sh           # Modo dev (default)
#   ./scripts/setup-db.sh prod      # Modo producción
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
SERVICE="$(postgres_service_name)"

DB_NAME="$(env_get POSTGRES_DB nexus_ops)"
DB_USER="$(env_get POSTGRES_USER nexus)"
ADMIN_EMAIL="$(env_get ADMIN_EMAIL "")"
ADMIN_PASSWORD="$(env_get ADMIN_PASSWORD "")"
ADMIN_ROLE="$(env_get ADMIN_ROLE admin)"
SETUP_DB_RESET="$(env_get SETUP_DB_RESET false)"

# ---------------------------------------------------------------------------
# 1. Levantar postgres y redis si no están corriendo
# ---------------------------------------------------------------------------
log "Paso 1/7 — Verificando contenedor $SERVICE..."
if ! compose_cmd "$MODE" ps "$SERVICE" 2>/dev/null | grep -qE "(Up|running)"; then
  log "Iniciando servicios: $SERVICE + redis..."
  compose_cmd "$MODE" up -d postgres redis
  ok "Servicios iniciados."
else
  ok "Contenedor $SERVICE ya está corriendo."
fi

# ---------------------------------------------------------------------------
# 2. Esperar a que postgres esté listo
# ---------------------------------------------------------------------------
log "Paso 2/7 — Esperando a que PostgreSQL esté disponible..."
wait_for_postgres "$MODE" 90

# ---------------------------------------------------------------------------
# 3. Eliminar (si existe) y recrear la base de datos desde cero
#    setup-db.sh siempre garantiza estado limpio para que las migraciones
#    corran desde cero sin conflictos de tablas residuales.
# ---------------------------------------------------------------------------
log "Paso 3/7 — Verificando base de datos '$DB_NAME'..."
DB_EXISTS="$(compose_cmd "$MODE" exec -T "$SERVICE" \
  psql -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || true)"

if [[ "$DB_EXISTS" == "1" ]]; then
  if [[ "$SETUP_DB_RESET" == "true" ]]; then
    warn "SETUP_DB_RESET=true detectado. Eliminando base de datos '$DB_NAME'..."
    compose_cmd "$MODE" exec -T "$SERVICE" psql -U "$DB_USER" -d postgres -c \
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" \
      >/dev/null 2>&1 || true
    compose_cmd "$MODE" exec -T "$SERVICE" psql -U "$DB_USER" -d postgres -c "DROP DATABASE \"$DB_NAME\";"
    ok "Base de datos eliminada."
    DB_EXISTS=""
  else
    ok "Base de datos '$DB_NAME' ya existe."
  fi
fi

if [[ "$DB_EXISTS" != "1" ]]; then
  log "Creando base de datos '$DB_NAME'..."
  compose_cmd "$MODE" exec -T "$SERVICE" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
  ok "Base de datos '$DB_NAME' creada."
fi

# ---------------------------------------------------------------------------
# 3b. Sanear estado inconsistente: tablas staging huerfanas sin alembic_version
#     Ocurre cuando tablas fueron creadas fuera de Alembic (backups parciales,
#     contenedor recreado, etc.) pero alembic_version no existe. Si se deja
#     asi, "alembic upgrade head" falla con DuplicateTable en staging.csv_files.
# ---------------------------------------------------------------------------
ALEMBIC_EXISTS="$(compose_cmd "$MODE" exec -T "$SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_name='alembic_version' AND table_schema='public'" \
  2>/dev/null || true)"

if [[ "$ALEMBIC_EXISTS" != "1" ]]; then
  STAGING_TABLES="$(compose_cmd "$MODE" exec -T "$SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='staging'" \
    2>/dev/null || echo "0")"

  if [[ "$STAGING_TABLES" =~ ^[0-9]+$ ]] && [[ "$STAGING_TABLES" -gt 0 ]]; then
    warn "Detectadas $STAGING_TABLES tablas en staging sin alembic_version. Saneando..."
    compose_cmd "$MODE" exec -T "$SERVICE" \
      psql -U "$DB_USER" -d "$DB_NAME" -c \
      "DROP TABLE IF EXISTS staging.csv_rows CASCADE;
       DROP TABLE IF EXISTS staging.csv_row_errors CASCADE;
       DROP TABLE IF EXISTS staging.csv_files CASCADE;" \
      >/dev/null 2>&1
    ok "Tablas staging huerfanas eliminadas. Alembic correra desde cero."
  fi
fi

# ---------------------------------------------------------------------------
# 4. Ejecutar migraciones Alembic (crea tablas si no existen)
# ---------------------------------------------------------------------------
log "Paso 4/8 — Ejecutando migraciones Alembic..."
MSYS_NO_PATHCONV=1 compose_cmd "$MODE" run --rm -T --no-deps \
  backend \
  alembic upgrade head
ok "Migraciones aplicadas."

# ---------------------------------------------------------------------------
# 5. Aplicar triggers y esquema app (recompute_all_rollups y funciones)
# ---------------------------------------------------------------------------
log "Paso 5/8 — Aplicando triggers y funciones (bootstrap_triggers.sql)..."
cat ./scripts/bootstrap_triggers.sql | \
  compose_cmd "$MODE" exec -T "$SERVICE" psql -U "$DB_USER" -d "$DB_NAME"
ok "Triggers y funciones aplicados."

# ---------------------------------------------------------------------------
# 6. Sincronizar datos CSV (borra existentes y recarga)
# ---------------------------------------------------------------------------
log "Paso 6/8 — Sincronizando datos CSV (modo replace)..."
MSYS_NO_PATHCONV=1 compose_cmd "$MODE" run --rm -T --no-deps \
  -e PYTHONPATH=/app \
  backend \
  python /app/scripts/sync_csv_data.py --force
ok "Datos CSV sincronizados."

# ---------------------------------------------------------------------------
# 7. Crear / actualizar usuario administrador
# ---------------------------------------------------------------------------
if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  warn "ADMIN_EMAIL/ADMIN_PASSWORD no configurados. Saltando creación de usuario administrador."
else
  log "Paso 7/8 — Creando usuario administrador ($ADMIN_EMAIL)..."
  MSYS_NO_PATHCONV=1 compose_cmd "$MODE" run --rm -T --no-deps \
    -e PYTHONPATH=/app \
    backend \
    python /app/scripts/create_admin_user.py \
      --email "$ADMIN_EMAIL" \
      --password "$ADMIN_PASSWORD" \
      --role "$ADMIN_ROLE"
  ok "Usuario administrador listo."
fi

# ---------------------------------------------------------------------------
# 8. Backup inicial
# ---------------------------------------------------------------------------
log "Paso 8/8 — Generando backup post-setup..."
bash ./scripts/backup-db.sh "setup_$(date -u +%Y%m%d_%H%M%S)" "$MODE"

ok "============================================================"
ok " Setup completado exitosamente."
ok " BD: $DB_NAME"
ok "============================================================"
