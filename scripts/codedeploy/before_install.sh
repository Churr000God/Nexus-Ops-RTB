#!/usr/bin/env bash
# =============================================================================
# before_install.sh — CodeDeploy: corre ANTES de copiar los nuevos archivos.
# Detiene los servicios de app en ejecución para evitar conflictos de escritura.
# La BD (Supabase) es externa y no se toca aquí.
# =============================================================================
set -euo pipefail

APP_DIR=/home/ec2-user/nexus-ops-rtb
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

log() { echo "[before_install] $*"; }

log "Iniciando pre-instalación..."

if [[ -f "$APP_DIR/docker-compose.yml" ]]; then
  cd "$APP_DIR"
  log "Deteniendo servicios de app (backend, frontend, proxy)..."
  $COMPOSE stop backend frontend proxy 2>/dev/null || true
  log "Servicios detenidos."
else
  log "No hay deployment previo. Primer despliegue."
fi

log "Pre-instalación completada."
