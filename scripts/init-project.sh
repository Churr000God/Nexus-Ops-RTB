#!/usr/bin/env bash
# =============================================================================
# init-project.sh — Inicialización del entorno de desarrollo Nexus Ops RTB
#
# En Windows (PowerShell / pwsh) usa el script nativo:
#   .\scripts\init-dev.ps1              # modo estándar
#   .\scripts\init-dev.ps1 -SkipRelay   # relay ya corriendo
#   .\scripts\init-dev.ps1 -WithFrontend
#
# Desde bash (Git Bash / WSL):
#   Este script invoca init-dev.ps1 si encuentra pwsh, o guía al usuario.
#   El relay Supabase DEBE estar corriendo antes de las migraciones.
# =============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "No estás dentro de un repositorio Git." >&2
  exit 1
fi
cd "$ROOT"

source ./scripts/lib/common.sh

# ── Detectar si pwsh está disponible ─────────────────────────────────────────
if command -v pwsh >/dev/null 2>&1; then
  log "Delegando a init-dev.ps1 (PowerShell)..."
  exec pwsh -File ./scripts/init-dev.ps1 "$@"
fi

# ── Fallback bash (sin relay automático) ─────────────────────────────────────
warn "pwsh no encontrado. Ejecutando flujo bash simplificado."
warn "IMPORTANTE: el relay Supabase debe estar corriendo en puerto 5433."
warn "  Abre otra terminal y ejecuta: python scripts/supabase-relay.py"
echo ""

require docker
require_env_file

# Verificar que el relay esté activo (puerto 5433)
log "Verificando relay Supabase en localhost:5433..."
if ! bash -c 'exec 3<>/dev/tcp/localhost/5433' 2>/dev/null; then
  err "Puerto 5433 no disponible. Inicia el relay primero:
  python scripts/supabase-relay.py"
fi
ok "Relay activo."

# Levantar stack (sin postgres — BD está en Supabase)
log "Levantando Redis y Backend..."
docker compose up -d --build redis backend
ok "Contenedores levantados."

# Esperar al backend
log "Esperando backend en puerto 8000 (max 60s)..."
elapsed=0
while (( elapsed < 60 )); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
    ok "Backend listo."
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

# Migraciones
log "Ejecutando migraciones Alembic..."
docker compose exec backend alembic upgrade head
ok "Migraciones aplicadas."

echo ""
ok "============================================================"
ok " Inicialización completada."
ok " API: http://localhost:8000   Docs: http://localhost:8000/docs"
ok "============================================================"
