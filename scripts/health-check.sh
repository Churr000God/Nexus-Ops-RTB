#!/usr/bin/env bash
# =============================================================================
# health-check.sh — Verificación de salud de todos los servicios
# Uso:  ./scripts/health-check.sh
# Exit: 0 si todos sanos, 1 si alguno falla
# =============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

source ./scripts/lib/common.sh

FAILURES=0
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check_service() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [[ "$STATUS" == "$expected" ]]; then
    ok "$name — HTTP $STATUS"
  else
    warn "$name — HTTP $STATUS (esperado $expected)"
    FAILURES=$((FAILURES + 1))
  fi
}

check_container() {
  local name="$1"
  local container="$2"

  STATE=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
  HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || echo "unknown")

  if [[ "$STATE" == "running" ]]; then
    if [[ "$HEALTH" == "healthy" || "$HEALTH" == "no-healthcheck" ]]; then
      ok "$name — running ($HEALTH)"
    else
      warn "$name — running pero $HEALTH"
      FAILURES=$((FAILURES + 1))
    fi
  else
    warn "$name — estado: $STATE"
    FAILURES=$((FAILURES + 1))
  fi
}

log "=== Health Check — $TIMESTAMP ==="
echo ""

# --- Contenedores Docker ---
log "Verificando contenedores..."
check_container "PostgreSQL" "nexus-ops-rtb-postgres-1"
check_container "Redis"      "nexus-ops-rtb-redis-1"
check_container "Backend"    "nexus-ops-rtb-backend-1"
check_container "Frontend"   "nexus-ops-rtb-frontend-1"
check_container "n8n"        "nexus-ops-rtb-n8n-1"
check_container "Proxy"      "nexus-ops-rtb-proxy-1"
echo ""

# --- Endpoints HTTP ---
log "Verificando endpoints..."
check_service "API Health"   "http://localhost:8000/health"
check_service "Proxy"        "http://localhost"
check_service "n8n"          "http://localhost:5678" "200"
echo ""

# --- Resumen ---
if [[ $FAILURES -eq 0 ]]; then
  ok "Todos los servicios están saludables."
  echo "$TIMESTAMP | status=healthy | failures=0" >> data/logs/health.log 2>/dev/null || true
  exit 0
else
  warn "$FAILURES servicio(s) con problemas."
  echo "$TIMESTAMP | status=degraded | failures=$FAILURES" >> data/logs/health.log 2>/dev/null || true
  exit 1
fi
