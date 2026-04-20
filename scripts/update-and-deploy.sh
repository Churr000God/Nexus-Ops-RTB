#!/usr/bin/env bash
# =============================================================================
# update-and-deploy.sh — Pipeline completo: pull repo + rebuild + deploy
# Uso:
#   ./scripts/update-and-deploy.sh              # Dev
#   ./scripts/update-and-deploy.sh prod         # Producción
#   ./scripts/update-and-deploy.sh prod --rebuild --force
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

MODE="${1:-dev}"
shift || true
DEPLOY_FLAGS=()
BRANCH="${UPDATE_BRANCH:-main}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|--rebuild|--recreate)
      DEPLOY_FLAGS+=("$1")
      ;;
    *)
      err "Flag no reconocido: $1"
      ;;
  esac
  shift
done

log "=== Update & Deploy Pipeline — $TIMESTAMP ==="
echo ""

# --- Paso 1: Backup de seguridad ---
log "Paso 1/5: Creando backup de base de datos..."
if bash ./scripts/backup-db.sh "pre_update_${TIMESTAMP//[:T-]/_}" "$MODE" 2>/dev/null; then
  ok "Backup creado."
else
  warn "No se pudo crear backup (puede que no haya BD activa). Continuando..."
fi
echo ""

# --- Paso 2: Pull del repositorio ---
log "Paso 2/5: Actualizando repositorio desde origin/$BRANCH..."
STASHED="false"
if [[ -n "$(git status --porcelain)" ]]; then
  warn "Hay cambios locales. Guardando en stash..."
  git stash push -u -m "update-deploy-$TIMESTAMP" >/dev/null
  STASHED="true"
fi

git fetch origin
git pull --ff-only origin "$BRANCH" || {
  warn "No se pudo hacer fast-forward. Intentando merge..."
  git merge origin/"$BRANCH" --no-edit || {
    err "Conflicto de merge. Resuelve manualmente antes de desplegar."
  }
}

if [[ "$STASHED" == "true" ]]; then
  set +e
  git stash pop >/dev/null 2>&1
  POP_CODE=$?
  set -e
  if [[ $POP_CODE -ne 0 ]]; then
    warn "Conflicto al restaurar stash. Los cambios están en git stash."
  fi
fi
ok "Repositorio actualizado."
echo ""

# --- Paso 3: Instalar dependencias si cambiaron ---
log "Paso 3/5: Verificando cambios en dependencias..."
DEPS_CHANGED="false"
if git diff HEAD~1 --name-only 2>/dev/null | grep -qE "(requirements\.txt|package\.json|package-lock\.json|Dockerfile)"; then
  DEPS_CHANGED="true"
  log "Se detectaron cambios en dependencias. Se hará rebuild completo."
  DEPLOY_FLAGS+=("--rebuild")
fi
echo ""

# --- Paso 4: Deploy ---
log "Paso 4/5: Ejecutando deploy..."
# shellcheck disable=SC2068
bash ./scripts/deploy.sh "$MODE" ${DEPLOY_FLAGS[@]}
echo ""

# --- Paso 5: Health check ---
log "Paso 5/5: Verificación de salud post-deploy..."
sleep 5
if bash ./scripts/health-check.sh "$MODE"; then
  ok "=== Update & Deploy completado exitosamente ==="
else
  warn "=== Deploy completado pero algunos servicios tienen problemas ==="
  warn "Revisa los logs: docker compose logs -f"
fi

# --- Log ---
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
echo "$TIMESTAMP | mode=$MODE | branch=$BRANCH | commit=$COMMIT | deps_changed=$DEPS_CHANGED | status=completed" \
  >> data/logs/update-deploy.log 2>/dev/null || true
