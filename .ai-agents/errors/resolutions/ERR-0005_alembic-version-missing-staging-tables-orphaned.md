# ERR-0005: setup-db.sh falla con DuplicateTable staging.csv_files — alembic_version perdida

**Fecha:** 2026-04-21
**Area:** db
**Severidad:** alto
**Estado:** resuelto

## Descripcion
Al ejecutar `./scripts/setup-db.sh`, el paso de migraciones Alembic falla con:

```
psycopg.errors.DuplicateTable: relation "csv_files" already exists
sqlalchemy.exc.ProgrammingError: (psycopg.errors.DuplicateTable) relation "csv_files" already exists
```

La migración `f6a0e4534684_create_ops_staging_tables.py` intenta crear `staging.csv_files` pero ya existe.

## Contexto
Se estaba ejecutando `setup-db.sh` en una BD que se encontraba en estado inconsistente:
- Existian solo 3 tablas: `staging.csv_files`, `staging.csv_row_errors`, `staging.csv_rows`
- No existia la tabla `alembic_version`
- No existian las tablas de auth (`users`, `refresh_tokens`) ni las tablas ops

## Causa Raiz
La tabla `alembic_version` fue eliminada (o nunca se creó) mientras las tablas de staging sí persistieron en el volumen de Docker. Sin `alembic_version`, Alembic asume que no hay ninguna migración aplicada e intenta correr todo desde cero, chocando con las tablas que ya existen.

Probable origen: un setup anterior corrió parcialmente y solo creó las tablas de staging antes de fallar, o se restauró un backup incompleto.

## Solucion
1. Verificar estado de la BD: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema','pg_catalog');`
2. Verificar que las tablas huerfanas estén vacías (no perder datos)
3. Eliminar las tablas de staging que bloquean la migración:
   ```sql
   DROP TABLE IF EXISTS staging.csv_rows CASCADE;
   DROP TABLE IF EXISTS staging.csv_row_errors CASCADE;
   DROP TABLE IF EXISTS staging.csv_files CASCADE;
   ```
4. Correr las migraciones: `docker compose exec backend alembic upgrade head`
5. Continuar con `./scripts/setup-db.sh` (los pasos posteriores de CSVs y admin)

## Prevencion
- Si se va a restaurar un backup parcial, verificar que incluya `alembic_version`
- Antes de correr `setup-db.sh`, verificar `alembic current` para detectar estado inconsistente
- Considerar agregar un check en `setup-db.sh` que detecte si `alembic_version` existe pero hay tablas sin registrar

## Archivos Afectados
- `backend/alembic/versions/f6a0e4534684_create_ops_staging_tables.py` — migración que falla (sin cambios, el problema estaba en la BD)

## Referencias
- [Alembic: stamp command](https://alembic.sqlalchemy.org/en/latest/api/commands.html#alembic.command.stamp) — alternativa para marcar una revision sin correrla
