#!/usr/bin/env bash
# =============================================================================
# update-safe.sh — Actualización segura del stack Nexus Ops RTB
#
# Flujo:
#   1. Descarga actualizaciones del repositorio (git pull)
#   2. Genera copia de seguridad de la base de datos
#   3. Construye las nuevas imágenes (sin reiniciar aún)
#   4. Restaura el backup en postgres (esquema + datos a estado conocido)
#   5. Aplica migraciones nuevas encima del backup restaurado
#   6. Levanta / reinicia los servicios de app (backend, frontend, proxy, ngrok)
#   7. Verifica salud del stack
#
# IMPORTANTE — Usuario administrador:
#   El usuario admin vive en la base de datos y viaja con el backup.
#   Las migraciones Alembic NO crean el usuario admin (eso lo hace setup-db.sh).
#   Este script restaura el backup ANTES de migrar, por lo que el usuario
#   queda intacto sin necesidad de volver a crearlo.
#
# Uso:
#   ./scripts/update-safe.sh          # Modo producción (default)
#   ./scripts/update-safe.sh --dry-run  # Muestra qué haría sin ejecutar
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
require git
require_env_file

# ---------------------------------------------------------------------------
# Argumentos
# ---------------------------------------------------------------------------
DRY_RUN="false"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="true" ;;
    *) warn "Argumento desconocido ignorado: $arg" ;;
  esac
done

MODE="prod"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BRANCH="${UPDATE_BRANCH:-main}"
BACKUP_TAG="pre_update_${TIMESTAMP}"
LOG_FILE="data/logs/update-safe.log"
mkdir -p data/logs

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [DRY-RUN] $*"
  else
    "$@"
  fi
}

log "================================================================="
log " update-safe.sh — $(date '+%Y-%m-%d %H:%M:%S')"
log "================================================================="
[[ "$DRY_RUN" == "true" ]] && warn "MODO DRY-RUN: no se ejecutará nada."
echo ""

# ---------------------------------------------------------------------------
# Paso 1 — Descargar actualizaciones del repositorio
# ---------------------------------------------------------------------------
log "Paso 1/7 — Descargando actualizaciones desde origin/$BRANCH..."

STASHED="false"
if [[ -n "$(git status --porcelain)" ]]; then
  warn "Hay cambios locales sin commitear. Guardando en stash temporalmente..."
  run git stash push -u -m "update-safe-$TIMESTAMP"
  STASHED="true"
fi

run git fetch origin

COMMITS_BEHIND=$(git rev-list HEAD..origin/"$BRANCH" --count 2>/dev/null || echo "0")
if [[ "$COMMITS_BEHIND" == "0" ]]; then
  ok "Ya estás al día con origin/$BRANCH. Continuando de todas formas."
else
  log "Hay $COMMITS_BEHIND commit(s) nuevos en origin/$BRANCH."
  run git pull --ff-only origin "$BRANCH" || {
    warn "No se pudo fast-forward. Intentando merge..."
    run git merge origin/"$BRANCH" --no-edit || {
      err "Conflicto de merge. Resuélvelo manualmente y vuelve a ejecutar."
    }
  }
fi

if [[ "$STASHED" == "true" ]]; then
  set +e
  run git stash pop
  POP_CODE=$?
  set -e
  if [[ $POP_CODE -ne 0 ]]; then
    warn "Conflicto al restaurar stash. Tus cambios siguen en 'git stash list'."
  fi
fi

COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
ok "Repositorio actualizado. Commit actual: $COMMIT"
echo ""

# ---------------------------------------------------------------------------
# Paso 2 — Generar copia de seguridad de la base de datos
# ---------------------------------------------------------------------------
log "Paso 2/7 — Generando backup de la base de datos..."

if compose_cmd "$MODE" ps postgres 2>/dev/null | grep -q "Up"; then
  run bash ./scripts/backup-db.sh "$BACKUP_TAG" "$MODE"
  BACKUP_FILE="$(ls -1t data/backups/${BACKUP_TAG}*.sql.gz 2>/dev/null | head -1 || true)"
  if [[ -z "$BACKUP_FILE" && "$DRY_RUN" == "false" ]]; then
    err "No se encontró el backup recién creado. Abortando por seguridad."
  fi
  ok "Backup guardado: ${BACKUP_FILE:-[dry-run]}"
else
  warn "PostgreSQL no está corriendo. Se omite el backup."
  warn "Se intentará restaurar el backup más reciente existente."
  BACKUP_FILE="$(ls -1t data/backups/*.sql.gz 2>/dev/null | head -1 || true)"
  if [[ -z "$BACKUP_FILE" ]]; then
    err "No hay backups disponibles y postgres no está activo. Abortando."
  fi
  warn "Se usará backup existente: $BACKUP_FILE"
fi
echo ""

# ---------------------------------------------------------------------------
# Paso 3 — Construir nuevas imágenes de la aplicación
# (postgres y redis no se reconstruyen — sus datos están en volúmenes)
# ---------------------------------------------------------------------------
log "Paso 3/7 — Construyendo nuevas imágenes (backend + frontend)..."
log "  PostgreSQL y Redis NO se tocan — sus datos están seguros en volúmenes."

run docker compose build backend frontend
ok "Imágenes construidas."
echo ""

# ---------------------------------------------------------------------------
# Paso 4 — Restaurar el backup en la base de datos
#
# Se restaura ANTES de las migraciones para tener un estado conocido.
# El usuario administrador viene incluido en el backup — no se crea de nuevo.
# ---------------------------------------------------------------------------
log "Paso 4/7 — Restaurando backup en la base de datos..."
log "  Backup: $BACKUP_FILE"
log "  NOTA: El usuario admin viaja con el backup — no se creará de nuevo."

if compose_cmd "$MODE" ps postgres 2>/dev/null | grep -q "Up"; then
  : # postgres ya corre
else
  log "  Levantando postgres y redis..."
  run compose_cmd "$MODE" up -d postgres redis
  run wait_for_postgres "$MODE" 90
fi

SERVICE="$(postgres_service_name)"
DB_NAME="$(env_get POSTGRES_DB nexus_ops)"
DB_USER="$(env_get POSTGRES_USER nexus)"

if [[ "$DRY_RUN" == "false" ]]; then
  # Terminar conexiones activas antes de drop/create
  compose_cmd "$MODE" exec -T "$SERVICE" psql -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true

  compose_cmd "$MODE" exec -T "$SERVICE" psql -U "$DB_USER" -d postgres -c \
    "DROP DATABASE IF EXISTS \"$DB_NAME\";" >/dev/null

  compose_cmd "$MODE" exec -T "$SERVICE" psql -U "$DB_USER" -d postgres -c \
    "CREATE DATABASE \"$DB_NAME\";" >/dev/null

  gunzip -c "$BACKUP_FILE" | compose_cmd "$MODE" exec -T "$SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" --single-transaction >/dev/null
else
  echo "  [DRY-RUN] DROP/CREATE DATABASE + restaurar $BACKUP_FILE"
fi

ok "Backup restaurado. Datos y usuario admin disponibles."
echo ""

# ---------------------------------------------------------------------------
# Paso 5 — Aplicar migraciones Alembic
#
# Las migraciones corren DESPUÉS del restore para agregar solo los cambios
# nuevos (columnas, tablas) que no existían en el backup.
# Alembic detecta qué migraciones ya están aplicadas via alembic_version.
# ---------------------------------------------------------------------------
log "Paso 5/7 — Aplicando migraciones Alembic..."
log "  Solo se aplican las migraciones nuevas — los datos existentes no se tocan."

if [[ "$DRY_RUN" == "false" ]]; then
  # Levantar backend temporalmente solo para correr alembic
  compose_cmd "$MODE" up -d backend
  # Esperar a que esté healthy
  ELAPSED=0
  while (( ELAPSED < 60 )); do
    STATUS=$(compose_cmd "$MODE" ps --format json backend 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].get('Health','') if isinstance(d,list) else d.get('Health',''))" 2>/dev/null || echo "")
    [[ "$STATUS" == "healthy" ]] && break
    sleep 3; ELAPSED=$((ELAPSED + 3))
  done
  compose_cmd "$MODE" exec -T backend alembic upgrade head
else
  echo "  [DRY-RUN] alembic upgrade head"
fi

ok "Migraciones aplicadas."
echo ""

# ---------------------------------------------------------------------------
# Paso 6 — Levantar / reiniciar todos los servicios de aplicación
# (backend, frontend, proxy, ngrok — NO postgres ni redis)
# ---------------------------------------------------------------------------
log "Paso 6/7 — Levantando servicios de aplicación..."

run compose_cmd "$MODE" up -d --force-recreate backend frontend

# El proxy necesita reiniciarse para refrescar el DNS interno de Docker
log "  Reiniciando proxy para refrescar DNS..."
sleep 5
run compose_cmd "$MODE" restart proxy

# ngrok si está configurado
if grep -q "NGROK_AUTHTOKEN" .env 2>/dev/null && \
   grep -qE "NGROK_AUTHTOKEN=.+" .env 2>/dev/null; then
  run compose_cmd "$MODE" up -d ngrok
  ok "ngrok levantado."
fi

ok "Servicios de aplicación activos."
echo ""

# ---------------------------------------------------------------------------
# Paso 7 — Verificación de salud
# ---------------------------------------------------------------------------
log "Paso 7/7 — Verificando salud del stack..."
sleep 6

HEALTH_OK="true"

check_service() {
  local name="$1"
  local status
  status=$(compose_cmd "$MODE" ps --format "{{.Status}}" "$name" 2>/dev/null || echo "")
  if echo "$status" | grep -qiE "(Up|running|healthy)"; then
    ok "  $name: UP"
  else
    warn "  $name: problema — Status: $status"
    HEALTH_OK="false"
  fi
}

for svc in postgres redis backend frontend proxy; do
  check_service "$svc"
done

# Verificar endpoint HTTP
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"_health_","password":"_check_"}' 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "422" ]]; then
  ok "  API backend: responde ($HTTP_CODE esperado)"
elif [[ "$HTTP_CODE" == "000" ]]; then
  warn "  API backend: no responde (timeout)"
  HEALTH_OK="false"
else
  warn "  API backend: respuesta inesperada ($HTTP_CODE)"
fi

echo ""
if [[ "$HEALTH_OK" == "true" ]]; then
  ok "================================================================="
  ok " Stack actualizado y saludable."
  ok " Commit: $COMMIT | Backup: ${BACKUP_FILE:-n/a}"
  ok "================================================================="
else
  warn "================================================================="
  warn " Stack actualizado pero algunos servicios tienen advertencias."
  warn " Revisa: docker compose logs -f"
  warn " Para revertir: AUTO_CONFIRM=true bash ./scripts/restore-db.sh $BACKUP_FILE"
  warn "================================================================="
fi

# ---------------------------------------------------------------------------
# Log de auditoría
# ---------------------------------------------------------------------------
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | commit=$COMMIT | backup=$BACKUP_FILE | health=$HEALTH_OK | dry_run=$DRY_RUN" \
  >> "$LOG_FILE" 2>/dev/null || true
