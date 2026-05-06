#!/usr/bin/env bash
# =============================================================================
# validate_service.sh — CodeDeploy: verifica que el stack responda tras el
# deploy. Si algún check crítico falla, sale con código 1 y CodeDeploy
# considera el deployment fallido (triggering rollback si está configurado).
# =============================================================================
set -euo pipefail

APP_DIR=/home/ec2-user/nexus-ops-rtb
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
FAILURES=0

log()  { echo "[validate_service] $*"; }
ok()   { echo "[validate_service]  OK  $*"; }
warn() { echo "[validate_service] WARN $*" >&2; }
fail() { echo "[validate_service] FAIL $*" >&2; FAILURES=$(( FAILURES + 1 )); }

cd "$APP_DIR"

# --- Contenedores críticos ---
log "Verificando contenedores..."
for svc in redis backend frontend proxy; do
  STATE=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    ps --format json "$svc" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); \
      rows=d if isinstance(d,list) else [d]; \
      print(rows[0].get('State','') if rows else '')" 2>/dev/null || echo "")
  if [[ "$STATE" == "running" ]]; then
    ok "$svc: running"
  else
    fail "$svc: estado inesperado '$STATE'"
  fi
done

# --- Endpoint de salud del backend (crítico) ---
log "Verificando endpoint /health del backend..."
HTTP=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 \
  http://localhost:8000/health 2>/dev/null || echo "000")
if [[ "$HTTP" == "200" ]]; then
  ok "GET /health → 200"
else
  fail "GET /health → $HTTP (esperado 200)"
fi

# --- Proxy en puerto 80 (crítico) ---
log "Verificando proxy en :80..."
HTTP=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 \
  http://localhost/ 2>/dev/null || echo "000")
if [[ "$HTTP" =~ ^(200|301|302)$ ]]; then
  ok "Proxy :80 → $HTTP"
else
  fail "Proxy :80 → $HTTP"
fi

# --- Resultado ---
echo ""
if (( FAILURES == 0 )); then
  ok "Todos los checks pasaron. Deployment exitoso."
  exit 0
else
  warn "$FAILURES check(s) fallaron. Revisa: docker compose logs -f"
  exit 1
fi
