# Scripts del Proyecto — Inventario y Referencia

Todos los scripts viven en `scripts/`. Se ejecutan desde la raíz del repositorio.

---

## Inventario actual

| Script | Propósito | Requiere |
|--------|-----------|----------|
| `init-project.sh` | **Arranque del proyecto** (bash → delega a init-dev.ps1) | pwsh o bash |
| `init-dev.ps1` | Implementación PowerShell del arranque completo | pwsh, docker |
| `stop.sh` | Detiene el stack preservando volúmenes | docker |
| `setup-db.sh` | Setup BD completo: migraciones + triggers + CSVs + admin | psql, docker |
| `backup-db.sh` | Backup comprimido de Supabase en `data/backups/` | pg_dump |
| `restore-db.sh` | Restaura backup en Supabase (más reciente si no se especifica) | psql |
| `update-safe.sh` | Pipeline prod: pull + backup + build + restore + migrate | psql, pg_dump, docker |
| `health-check.sh` | Verifica estado de contenedores y endpoints | docker, curl |
| `pull-auto.sh` / `.ps1` | git pull automático con stash | git |
| `push-auto-branch.sh` / `.ps1` | Crea rama y hace push automático | git |
| `supabase-relay.py` | Proxy TCP Supabase → localhost:5433 (necesario en Windows/WSL2) | python3 |
| `import_sat_catalogs.py` | Importa catálogos SAT desde CSV a Supabase | python3, psycopg3 |
| `bootstrap_triggers.sql` | DDL de triggers y funciones PostgreSQL | — (aplicado por setup-db.sh) |
| `lib/common.sh` | Funciones compartidas: `log`, `ok`, `warn`, `err`, `compose_cmd` | — |

---

## Flujos de uso comunes

### Iniciar el proyecto (dev)

```powershell
# Windows — PowerShell (recomendado)
.\scripts\init-dev.ps1
.\scripts\init-dev.ps1 -SkipRelay       # relay ya corriendo en otra terminal
.\scripts\init-dev.ps1 -WithFrontend    # incluye frontend
.\scripts\init-dev.ps1 -SkipMigrations  # solo docker, sin alembic
```

```bash
# bash / Git Bash
bash ./scripts/init-project.sh
```

El script:
1. Verifica `.env` (copia `.env.example` si no existe).
2. Arranca `supabase-relay.py` en nueva ventana (puerto 5433) si el puerto no está activo.
3. Levanta `redis` + `backend` con `docker compose up -d --build`.
4. Espera a que `/health` responda.
5. Ejecuta `alembic upgrade head`.

### Detener el stack

```bash
bash ./scripts/stop.sh        # dev
bash ./scripts/stop.sh prod   # prod
```

### Reconstruir solo la app (sin tocar BD)

```bash
docker compose up -d --build backend frontend
```

La BD está en Supabase — no se ve afectada por ningún rebuild de contenedores.

### Setup de BD desde cero

```bash
bash ./scripts/setup-db.sh
```

Pasos que ejecuta:
1. Verifica conectividad con Supabase.
2. Levanta Redis si no está corriendo.
3. `alembic upgrade head`.
4. Aplica `bootstrap_triggers.sql` (triggers y funciones PL/pgSQL).
5. Sincroniza CSVs con `sync_csv_data.py --force`.
6. Crea/actualiza usuario administrador.

Requiere `psql` instalado localmente y `SUPABASE_HOST` configurado en `.env`.

### Backup y restore

```bash
bash ./scripts/backup-db.sh                        # backup con timestamp
bash ./scripts/backup-db.sh nombre_custom          # nombre personalizado
bash ./scripts/restore-db.sh                       # restaura el más reciente
bash ./scripts/restore-db.sh data/backups/foo.sql.gz
AUTO_CONFIRM=true bash ./scripts/restore-db.sh     # sin prompt (scripts CI)
```

### Actualización de producción

```bash
bash ./scripts/update-safe.sh           # actualización completa
bash ./scripts/update-safe.sh --dry-run # simula sin ejecutar
```

Pasos que ejecuta:
1. `git pull` (con stash si hay cambios locales).
2. Backup de Supabase.
3. `docker compose build backend frontend`.
4. DROP/CREATE schema public + restaurar backup.
5. `alembic upgrade head`.
6. `docker compose up -d --force-recreate backend frontend` + restart proxy.
7. Health check final.

### Health check manual

```bash
bash ./scripts/health-check.sh        # dev
bash ./scripts/health-check.sh prod   # prod
```

Verifica: Redis, Backend, Frontend, n8n, Proxy (+ Cloudflared en prod).  
Nota: no verifica postgres local — la BD está en Supabase.

---

## lib/common.sh — funciones disponibles

```bash
log "mensaje"          # [INFO] en stdout
ok "mensaje"           # [ OK ] en stdout
warn "mensaje"         # [WARN] en stderr
err "mensaje"          # [ERR ] en stderr + exit 1

require docker         # verifica que el comando existe
require_env_file       # verifica que existe .env

env_get CLAVE default  # lee variable de .env

compose_cmd dev up -d  # docker compose [-f ...] args
                       # dev  → solo docker-compose.yml
                       # prod → docker-compose.yml + docker-compose.prod.yml

wait_for_supabase HOST USER PASS DB [TIMEOUT]  # espera conexión postgres
```

---

## Conventional Commits

Los commits de este proyecto siguen la convención:

```
feat(scope):  nueva funcionalidad
fix(scope):   corrección de bug
docs(scope):  solo documentación
refactor:     refactoring sin cambio de comportamiento
chore:        tareas de mantenimiento (scripts, deps)
```

---

## Notas de seguridad

- Nunca commitear `.env` (está en `.gitignore`).
- `update-safe.sh` hace `DROP SCHEMA public CASCADE` en Supabase antes de restaurar — siempre genera backup previo.
- `restore-db.sh` pide confirmación interactiva excepto con `AUTO_CONFIRM=true`.
