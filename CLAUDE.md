# Nexus Ops RTB — Instrucciones para Claude Code

## Proyecto
Sistema de operaciones interno para RTB. Stack: FastAPI + PostgreSQL + Redis + React + Docker Compose.
Documentación detallada en `estructura_proyecto/`, contexto de negocio en `contexto/`.

## Reglas críticas

### PROTECCIÓN DEL CONTENEDOR DE POSTGRESQL
**NUNCA** ejecutes ninguno de los siguientes comandos sin pedir confirmación explícita al usuario primero:
- `docker compose down` (si incluye el servicio `postgres`)
- `docker compose down -v` (destruye volúmenes con datos)
- `docker volume rm` sobre `postgres_data` o cualquier volumen de BD
- `docker compose up --build` con `--force-recreate` sobre `postgres`
- Eliminar, recrear o reinicializar el contenedor `postgres`
- Borrar la carpeta de datos del volumen de PostgreSQL

Antes de ejecutar cualquiera de estas acciones **siempre pregunta**:
> "Esto podría destruir todos los datos de PostgreSQL. ¿Confirmas que quieres continuar?"

Si el usuario responde que sí, recuérdale que ejecute `./scripts/setup-db.sh` después para restaurar la BD.

### Reconstrucción segura
Para reconstruir servicios SIN destruir datos usa:
```bash
docker compose up -d --build backend frontend   # Solo app, nunca postgres
bash ./scripts/rebuild-safe.sh                  # Script seguro existente
```

Para reconstruir DESDE CERO (con pérdida de datos aceptada por el usuario):
```bash
bash ./scripts/setup-db.sh   # Restaura BD completa después de recrear postgres
```

---

## Scripts principales de base de datos

| Script | Propósito |
|--------|-----------|
| `./scripts/setup-db.sh` | Setup completo: levanta postgres, migraciones, CSVs, usuario admin, backup |
| `./scripts/backup-db.sh` | Crea un backup comprimido en `data/backups/` |
| `./scripts/restore-db.sh` | Restaura backup (sin argumento: usa el más reciente) |

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
