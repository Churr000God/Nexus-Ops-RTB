#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Despliegue automático del stack Nexus Ops RTB
# Uso:
#   ./scripts/deploy.sh              # Deploy en modo desarrollo
#   ./scripts/deploy.sh prod         # Deploy en modo producción
#   ./scripts/deploy.sh prod --force # Forzar rebuild sin cache
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

# --- Argumentos ---
MODE="${1:-dev}"
FORCE="${2:-}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- Validaciones ---
if [[ ! -f .env ]]; then
  err "No existe .env. Ejecuta: cp .env.example .env y configura los valores."
fi

# --- Crear directorios necesarios ---
mkdir -p data/csv data/reports data/logs data/backups \
         automations/n8n_data automations/n8n_flows \
         docker/nginx/certs

# --- Funciones ---
deploy_dev() {
  log "Desplegando en modo DESARROLLO..."

  if [[ "$FORCE" == "--force" ]]; then
    log "Rebuild forzado (sin cache)..."
    docker compose build --no-cache
  else
    docker compose build
  fi

  docker compose up -d
  log "Esperando que los servicios estén saludables..."
  sleep 5
  bash ./scripts/health-check.sh || warn "Algunos servicios no responden aún."
  ok "Deploy DEV completado — $TIMESTAMP"
  ok "Proxy: http://localhost"
  ok "API:   http://localhost/api/health"
  ok "n8n:   http://localhost/n8n/"
}

deploy_prod() {
  log "Desplegando en modo PRODUCCIÓN..."

  # Verificar que exista el archivo de credenciales de Cloudflare
  if [[ ! -f docker/cloudflared/credentials.json ]]; then
    warn "No se encontró docker/cloudflared/credentials.json"
    warn "El túnel Cloudflare no funcionará sin este archivo."
  fi

  if [[ "$FORCE" == "--force" ]]; then
    log "Rebuild forzado (sin cache)..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
  else
    docker compose -f docker-compose.yml -f docker-compose.prod.yml build
  fi

  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
  log "Esperando que los servicios estén saludables..."
  sleep 8
  bash ./scripts/health-check.sh || warn "Algunos servicios no responden aún."
  ok "Deploy PROD completado — $TIMESTAMP"
}

rollback() {
  warn "Iniciando rollback..."
  docker compose down
  git checkout HEAD~1 -- docker-compose.yml docker-compose.prod.yml backend/ frontend/
  deploy_"$MODE"
}

# --- Ejecución ---
case "$MODE" in
  dev)
    deploy_dev
    ;;
  prod|production)
    deploy_prod
    ;;
  rollback)
    rollback
    ;;
  *)
    err "Modo no reconocido: $MODE. Usa: dev, prod, rollback"
    ;;
esac

# --- Log del despliegue ---
echo "$TIMESTAMP | mode=$MODE | commit=$(git rev-parse --short HEAD 2>/dev/null || echo 'n/a') | status=success" \
  >> data/logs/deploy.log
