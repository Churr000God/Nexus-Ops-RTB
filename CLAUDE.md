# Nexus Ops RTB — Instrucciones para Claude Code

## Proyecto
Sistema de operaciones interno para RTB. Stack: FastAPI + PostgreSQL + Redis + React + Docker Compose.
Documentación detallada en `estructura_proyecto/`, contexto de negocio en `contexto/`.

## Reglas críticas

### BD EN SUPABASE — sin contenedor postgres local
La base de datos vive en **Supabase** (externa). No hay contenedor `postgres` local en Docker Compose.
**NUNCA** ejecutes los siguientes comandos sin confirmación explícita:
- `docker compose down -v` (destruye volúmenes Docker — afecta redis, n8n)
- `DROP SCHEMA public CASCADE` en Supabase sin backup previo
- Eliminar el proyecto Supabase o resetear la BD

Antes de cualquier acción destructiva sobre datos **siempre pregunta**:
> "Esto podría destruir datos en Supabase. ¿Confirmas que quieres continuar?"

### Iniciar el proyecto
```bash
bash ./scripts/init-project.sh          # bash / Git Bash (delega a init-dev.ps1 si hay pwsh)
.\scripts\init-dev.ps1                  # PowerShell nativo — levanta todo excepto ngrok
.\scripts\init-dev.ps1 -SkipRelay       # relay ya corriendo en otra terminal
.\scripts\init-dev.ps1 -WithNgrok       # incluir ngrok (requiere NGROK_AUTHTOKEN en .env)
.\scripts\init-dev.ps1 -SkipN8n         # modo ligero: omite n8n y postgres-n8n
```

Servicios que levanta por defecto: `redis`, `backend`, `postgres-n8n`, `n8n`, `frontend`, `proxy`.

### Reconstruir sin perder datos
```bash
docker compose up -d --build backend frontend   # Solo app; la BD no se toca (está en Supabase)
```

### Restablecer BD desde cero
```bash
bash ./scripts/setup-db.sh   # Migraciones + triggers + CSVs + usuario admin
```

---

## Scripts disponibles

| Script | Propósito |
|--------|-----------|
| `./scripts/init-project.sh` | **Arranque del proyecto** — relay + docker + migraciones |
| `./scripts/init-dev.ps1` | Implementación PowerShell del arranque (llamado por init-project.sh) |
| `./scripts/stop.sh` | Detener el stack (preserva volúmenes) |
| `./scripts/setup-db.sh` | Setup completo de BD: migraciones, triggers, CSVs, usuario admin |
| `./scripts/backup-db.sh` | Backup comprimido en `data/backups/` |
| `./scripts/restore-db.sh` | Restaurar backup (sin argumento: usa el más reciente) |
| `./scripts/update-safe.sh` | Actualización producción: pull + backup + build + restore + migrate |
| `./scripts/health-check.sh` | Verificar estado de todos los servicios |

## Variables de entorno clave (`.env`)
- `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` — credenciales de PostgreSQL
- `DATABASE_URL` — URL de conexión para SQLAlchemy (dentro de la red Docker)
- `JWT_SECRET` — secreto para tokens JWT

## Migraciones
```bash
docker compose exec backend alembic upgrade head    # Aplicar migraciones pendientes
docker compose exec backend alembic revision --autogenerate -m "descripcion"  # Nueva migración
```

## Convenciones
- Tablas operativas: snake_case en español (ventas, pedidos_clientes, facturas_compras…)
- Tablas de auth: inglés (users, refresh_tokens)
- Las migraciones de datos van DESPUÉS de todas las DDL (regla establecida)
- Errores 500 en FastAPI deben incluir cabeceras CORS (ver middleware configurado)
