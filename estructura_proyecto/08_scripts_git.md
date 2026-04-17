# Scripts de Sincronización con Git y Despliegue

**Propósito:** Definir los scripts que permiten:
- Actualizar el repositorio local desde el remoto (pull seguro + rebuild).
- Enviar cambios locales al repositorio remoto (commit + push controlado).
- Desplegar/actualizar la aplicación en contenedores.

Todos viven en `scripts/` y son ejecutables (`chmod +x`).

---

## 1. Estructura de Directorios

```
scripts/
├── update-repo.sh            # Pull del remoto, rebuild, migrate, reiniciar
├── push-repo.sh              # Commit + push al remoto (con verificaciones)
├── deploy.sh                 # Despliegue en servidor (prod)
├── backup-db.sh              # Backup de PostgreSQL
├── restore-db.sh             # Restauración de backup
├── rotate-secrets.sh         # Rotación de JWT_SECRET / tokens
├── update-cf-ips.sh          # Refresca IPs de Cloudflare en Nginx
├── init-project.sh           # Setup inicial (primer arranque)
├── export-n8n-flows.sh       # Exporta flujos a automations/n8n_flows
├── import-n8n-flows.sh       # Importa flujos
└── lib/
    ├── common.sh             # Funciones compartidas (log, err, check)
    └── config.sh             # Carga .env
```

---

## 2. `lib/common.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

log()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()   { echo -e "\033[1;32m[ OK ]\033[0m  $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()  { echo -e "\033[1;31m[ERR ]\033[0m  $*" >&2; exit 1; }

require() {
    command -v "$1" >/dev/null 2>&1 || err "Falta dependencia: $1"
}

confirm() {
    read -rp "$1 [y/N] " r
    [[ "$r" =~ ^[Yy]$ ]]
}
```

---

## 3. `update-repo.sh` (pull + rebuild)

```bash
#!/usr/bin/env bash
# Actualiza el repositorio local y aplica cambios al entorno
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

BRANCH="${1:-main}"

require git
require docker

log "Verificando estado del repositorio..."
if [[ -n "$(git status --porcelain)" ]]; then
    warn "Hay cambios locales sin commitear:"
    git status --short
    confirm "¿Continuar? Los cambios se stashearan." || err "Cancelado."
    git stash push -m "auto-stash-$(date +%s)"
fi

log "Trayendo cambios del remoto (rama $BRANCH)..."
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
ok "Código actualizado."

log "Reconstruyendo imágenes..."
docker compose build

log "Aplicando migraciones..."
docker compose up -d postgres redis
docker compose run --rm backend alembic upgrade head

log "Reiniciando servicios..."
docker compose up -d

ok "Actualización completada."
docker compose ps
```

---

## 4. `push-repo.sh` (commit + push seguro)

```bash
#!/usr/bin/env bash
# Commitea y hace push al remoto, corriendo lint/tests antes
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

MSG="${1:-}"
[[ -z "$MSG" ]] && err "Uso: push-repo.sh \"mensaje de commit\""

require git

log "Ejecutando lint/tests antes de push..."

# Backend (si hay cambios)
if git diff --cached --name-only | grep -q "^backend/"; then
    docker compose run --rm backend bash -c "ruff check . && pytest -q"
fi

# Frontend (si hay cambios)
if git diff --cached --name-only | grep -q "^frontend/"; then
    docker compose run --rm frontend bash -c "npm run lint && npm run test -- --run"
fi

ok "Checks pasaron."

log "Agregando archivos..."
git add -A
git status --short

confirm "¿Confirmar commit y push?" || err "Cancelado."

git commit -m "$MSG"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "Push a origin/$BRANCH..."
git push origin "$BRANCH"

ok "Push completado."
```

---

## 5. `deploy.sh` (despliegue en servidor)

```bash
#!/usr/bin/env bash
# Ejecutar en el servidor de producción
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

PROJECT_DIR="${PROJECT_DIR:-/opt/nexus-ops-rtb}"
cd "$PROJECT_DIR"

log "Actualizando código..."
git fetch origin
git checkout main
git pull --ff-only origin main

log "Construyendo imágenes de producción..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

log "Aplicando migraciones..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm backend alembic upgrade head

log "Levantando servicios..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

log "Esperando healthchecks..."
sleep 10
curl -fsS http://localhost/api/health || warn "Health endpoint no responde"

ok "Despliegue completado."
docker compose ps
```

---

## 6. `backup-db.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

STAMP=$(date +%Y%m%d_%H%M)
DEST="${BACKUP_DIR:-./database/backups}/nexus_ops_${STAMP}.sql.gz"
mkdir -p "$(dirname "$DEST")"

log "Dump de PostgreSQL → $DEST"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DEST"

# Retención: 7 diarios + 4 semanales + 6 mensuales
log "Aplicando política de retención..."
find "$(dirname "$DEST")" -name "nexus_ops_*.sql.gz" -mtime +60 -delete

ok "Backup listo."
```

---

## 7. `restore-db.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

FILE="${1:-}"
[[ -z "$FILE" || ! -f "$FILE" ]] && err "Uso: restore-db.sh <ruta.sql.gz>"

warn "Esto reemplazará el contenido de la base actual."
confirm "¿Continuar?" || err "Cancelado."

log "Restaurando $FILE..."
gunzip -c "$FILE" | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"

ok "Restauración completa."
```

---

## 8. `init-project.sh`

```bash
#!/usr/bin/env bash
# Setup inicial en un entorno nuevo
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

log "Verificando .env..."
[[ ! -f .env ]] && cp .env.example .env && warn "Se copió .env.example → .env. Configúralo antes de continuar."

log "Creando carpetas de datos..."
mkdir -p data/csv data/reports database/backups automations/n8n_data

log "Levantando infraestructura (postgres, redis)..."
docker compose up -d postgres redis

log "Esperando a que Postgres esté listo..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-nexus}" >/dev/null 2>&1; do
    sleep 2
done

log "Construyendo imágenes..."
docker compose build

log "Aplicando migraciones..."
docker compose run --rm backend alembic upgrade head

log "Cargando seeds (opcional)..."
confirm "¿Cargar datos de seed?" && docker compose run --rm backend python -m app.scripts.seed

log "Importando flujos de n8n..."
./scripts/import-n8n-flows.sh || warn "No se pudieron importar flujos (ver n8n)."

log "Arrancando todos los servicios..."
docker compose up -d

ok "Proyecto inicializado. Accede en http://localhost"
```

---

## 9. `export-n8n-flows.sh` y `import-n8n-flows.sh`

```bash
# export
docker compose exec n8n n8n export:workflow --all --output=/flows/
```

```bash
# import
docker compose exec n8n n8n import:workflow --separate --input=/flows/
```

---

## 10. Flujo Recomendado para Diego

### En su máquina de desarrollo
1. Programar cambios.
2. `./scripts/push-repo.sh "feat: nueva gráfica de gastos"`.
3. En el servidor: `./scripts/deploy.sh` (o vía GitHub Action).

### Para sincronizar desde el remoto
- En cualquier máquina con el repo: `./scripts/update-repo.sh`.

### Para hacer backup antes de un cambio grande
- `./scripts/backup-db.sh` antes del deploy.

---

## 11. Buenas Prácticas

- No ejecutar `push-repo.sh` sin primero haber corrido `update-repo.sh` para evitar conflictos.
- Los scripts no deben borrar datos sin confirmación (`confirm` de `lib/common.sh`).
- Nunca pushear `.env` aunque se modifique `.env.example` primero.
- Los commits deben seguir Conventional Commits (`feat:`, `fix:`, `docs:`, etc.) para que los changelogs sean automatizables.
