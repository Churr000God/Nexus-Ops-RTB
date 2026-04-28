#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Despliegue automático del stack Nexus Ops RTB
# Uso:
#   ./scripts/deploy.sh                        # Deploy en modo desarrollo
#   ./scripts/deploy.sh prod                   # Deploy en modo producción
#   ./scripts/deploy.sh prod --rebuild         # Rebuild de imágenes
#   ./scripts/deploy.sh prod --rebuild --force # Rebuild sin cache
#   ./scripts/deploy.sh dev --recreate         # Re-crear contenedores
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

# --- Argumentos ---
MODE="${1:-dev}"
shift || true
FORCE="false"
REBUILD="false"
RECREATE="false"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE="true" ;;
    --rebuild) REBUILD="true" ;;
    --recreate) RECREATE="true" ;;
    *) err "Flag no reconocido: $1" ;;
  esac
  shift
done

# --- Crear directorios necesarios ---
mkdir -p data/csv data/reports data/logs data/backups \
         automations/n8n_data automations/n8n_flows \
         docker/nginx/certs

build_images_if_needed() {
  if [[ "$REBUILD" != "true" ]]; then
    return
  fi

  if [[ "$FORCE" == "true" ]]; then
    log "Rebuild forzado (sin cache)..."
    compose_cmd "$MODE" build --no-cache
  else
    log "Rebuild de imágenes..."
    compose_cmd "$MODE" build
  fi
}

up_stack() {
  local up_args=(-d --remove-orphans)
  if [[ "$RECREATE" == "true" ]]; then
    up_args+=(--force-recreate)
  fi

  # shellcheck disable=SC2068
  compose_cmd "$MODE" up ${up_args[@]}
}

check_supabase() {
  local db_host db_user db_pass db_name
  db_host="$(env_get SUPABASE_HOST '')"
  db_user="$(env_get POSTGRES_USER postgres)"
  db_pass="$(env_get POSTGRES_PASSWORD '')"
  db_name="$(env_get POSTGRES_DB postgres)"
  if [[ -n "$db_host" ]]; then
    wait_for_supabase "$db_host" "$db_user" "$db_pass" "$db_name" 30
  else
    warn "SUPABASE_HOST no configurado — omitiendo verificación de BD."
  fi
}

deploy_dev() {
  log "Desplegando en modo DESARROLLO..."
  build_images_if_needed
  up_stack
  log "Verificando conexión a Supabase..."
  check_supabase
  bash ./scripts/health-check.sh dev || warn "Algunos servicios no responden aún."
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

  build_images_if_needed
  up_stack
  log "Verificando conexión a Supabase..."
  check_supabase
  bash ./scripts/health-check.sh prod || warn "Algunos servicios no responden aún."
  ok "Deploy PROD completado — $TIMESTAMP"
}

# --- Ejecución ---
case "$MODE" in
  dev)
    deploy_dev
    ;;
  prod|production)
    MODE="prod"
    deploy_prod
    ;;
  *)
    err "Modo no reconocido: $MODE. Usa: dev, prod"
    ;;
esac

# --- Log del despliegue ---
echo "$TIMESTAMP | mode=$MODE | commit=$(git rev-parse --short HEAD 2>/dev/null || echo 'n/a') | status=success" \
  >> data/logs/deploy.log
