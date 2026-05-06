#!/usr/bin/env bash
# =============================================================================
# application_start.sh — CodeDeploy: construye imágenes, aplica migraciones
# y levanta el stack completo de producción.
#
# Flujo:
#   1. Construir imágenes backend + frontend
#   2. Levantar redis (dependencia de backend)
#   3. Levantar backend y esperar a que esté healthy
#   4. Aplicar migraciones Alembic
#   5. Levantar frontend, proxy y cloudflared
# =============================================================================
set -euo pipefail

APP_DIR=/home/ec2-user/nexus-ops-rtb
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

log()  { echo "[application_start] $*"; }
ok()   { echo "[application_start]  OK  $*"; }
err()  { echo "[application_start] ERROR: $*" >&2; exit 1; }

cd "$APP_DIR"

[[ -f .env ]] || err "No existe .env — ejecuta after_install primero."

# ---------------------------------------------------------------------------
# Paso 1 — Construir imágenes
# ---------------------------------------------------------------------------
log "Construyendo imágenes (backend + frontend)..."
$COMPOSE build backend frontend
ok "Imágenes construidas."

# ---------------------------------------------------------------------------
# Paso 2 — Levantar Redis
# ---------------------------------------------------------------------------
log "Levantando redis..."
$COMPOSE up -d redis
ok "Redis iniciado."

# ---------------------------------------------------------------------------
# Paso 3 — Levantar backend y esperar salud
# ---------------------------------------------------------------------------
log "Levantando backend..."
$COMPOSE up -d backend

ELAPSED=0
MAX_WAIT=90
log "Esperando a que backend sea healthy (máx ${MAX_WAIT}s)..."
while (( ELAPSED < MAX_WAIT )); do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' \
    "$(docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q backend)" 2>/dev/null || echo "")
  if [[ "$HEALTH" == "healthy" ]]; then
    ok "Backend healthy."
    break
  fi
  sleep 5
  ELAPSED=$(( ELAPSED + 5 ))
done

if [[ "$HEALTH" != "healthy" ]]; then
  log "Backend no alcanzó 'healthy' en ${MAX_WAIT}s — continuando de todas formas."
fi

# ---------------------------------------------------------------------------
# Paso 4 — Migraciones Alembic
# ---------------------------------------------------------------------------
log "Aplicando migraciones Alembic..."
$COMPOSE exec -T backend alembic upgrade head
ok "Migraciones aplicadas."

# ---------------------------------------------------------------------------
# Paso 5 — Levantar resto de servicios
# ---------------------------------------------------------------------------
log "Levantando frontend, proxy y cloudflared..."
$COMPOSE up -d frontend proxy cloudflared

# Reload proxy para refrescar upstreams
sleep 4
$COMPOSE exec -T proxy nginx -s reload 2>/dev/null || $COMPOSE restart proxy

ok "Stack de producción activo."
