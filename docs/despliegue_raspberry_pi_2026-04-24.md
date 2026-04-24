# Despliegue en Raspberry Pi — 2026-04-24

## Resumen

Sesión de resolución de errores de despliegue del stack Nexus Ops RTB en una Raspberry Pi
(IP `192.168.0.94`). Se partió de un stack que no levantaba y se llegó a un sistema completamente
funcional con sincronización de datos operativa desde n8n Cloud vía ngrok.

---

## Errores corregidos

### 1. nginx — proxy no levantaba
**Causa:** `proxy_pass` incluía el puerto que ya estaba declarado en el bloque `upstream`.
**Fix:** `docker/nginx/default.conf` — eliminar puerto de `proxy_pass`; usar `http://backend/api/`
en lugar de `http://backend:8000/api/`.

### 2. CORS bloqueado en frontend
**Causa:** El frontend hacía peticiones a `http://localhost:8000` desde `192.168.0.94:5173`;
`ALLOWED_ORIGINS` no incluía la IP del cliente.
**Fix:**
- `ALLOWED_ORIGINS` ampliado a incluir `http://192.168.0.94` y `http://192.168.0.94:5173`.
- `VITE_API_URL=` (vacío) para que el frontend use URLs relativas y las peticiones pasen por el proxy.

### 3. Doble prefijo `/api/api/`
**Causa:** `${VITE_API_URL:-/api}` en `docker-compose.yml` usaba `/api` como fallback cuando la
variable estaba vacía (comportamiento de `:-` en bash).
**Fix:** Cambiado a `${VITE_API_URL}` sin fallback.

### 4. Backend 503 — autenticación PostgreSQL fallida
**Causa:** El rol `nexus` no tenía contraseña asignada correctamente tras recrear el contenedor.
**Fix:** `ALTER USER nexus WITH PASSWORD '...'` ejecutado dentro del contenedor vía socket Unix
(modo `trust`).

### 5. `relation "users" does not exist`
**Causa:** Migraciones Alembic no habían sido ejecutadas.
**Fix:** `docker compose exec backend alembic upgrade head`

### 6. Migration — `column excluded.short_code does not exist`
**Causa:** `Model.__table__` contiene columnas de migraciones futuras; la BD aún no las tiene.
**Fix:** En `_bulk_upsert` filtrar las columnas del upsert a las que realmente existen en la BD
en ese momento con `sa.inspect(conn).get_columns(table.name)`.

### 7. Migration — `CardinalityViolation` (clave de conflicto duplicada en el mismo lote)
**Causa:** El mismo CSV contenía filas con idéntica clave de conflicto en el mismo batch.
**Fix:** Deduplicación por `conflict_cols` antes del insert en `_bulk_upsert`.

### 8. Sync — `UniqueViolation` en `cotizacion_items_pkey` (entre batches)
**Causa:** `cotizacion_items` tiene PK en `id` Y UNIQUE en `(quote_id, line_external_id)`; ambas
deben deduplicarse globalmente antes de hacer chunks.
**Fix:**
- `_import_quote_items`: deduplicación global por `id` y luego por `(quote_id, line_external_id)`.
- `conflict_cols` cambiado de `["quote_id", "line_external_id"]` a `["id"]`.

### 9. Sync — `schema "app" does not exist` (`recompute_all_rollups`)
**Causa:** La función PostgreSQL `app.recompute_all_rollups()` es referenciada en el script pero
nunca fue creada en la BD.
**Fix:** Añadir flag `--skip-rollups` al subproceso en `sync_service.py`.

### 10. Sync — 401 Unauthorized (clave inválida)
**Causa:** n8n enviaba `x-sync-key: rtb-sync-2026` pero el backend esperaba otro valor.
**Fix:** `SYNC_API_KEY=rtb-sync-2026` en `.env`; requirió `--force-recreate` (no solo `restart`)
para que el contenedor tomara la nueva variable de entorno.

### 11. 502 recurrente tras recrear el contenedor de backend
**Causa:** nginx cachea IPs de upstream; tras recrear `backend`, la IP Docker cambia y nginx
sirve la antigua.
**Fix:** `docker compose restart proxy` después de cualquier recreación del contenedor `backend`.

---

## Nuevas funcionalidades añadidas

### ngrok — túnel público permanente
n8n Cloud no puede alcanzar la IP privada `192.168.0.94`. Se añadió el servicio `ngrok` con
dominio estático para exponer el stack:

- **Dominio:** `caress-shortlist-disarm.ngrok-free.dev`
- **Authtoken:** configurado en `.env` como `NGROK_AUTHTOKEN`
- El servicio se declara en `docker-compose.yml` con `restart: unless-stopped`

### Variables de entorno Vite en tiempo de build
Las variables `VITE_*` deben estar disponibles durante el `npm run build`, no en tiempo de
ejecución. Se añadieron `ARG VITE_API_URL=` y `ENV VITE_API_URL=$VITE_API_URL` en
`frontend/Dockerfile` antes del step de build.

### Script `update-safe.sh`
Script de actualización segura de 7 pasos que protege los datos y el usuario admin:

1. `git pull` con stash automático de cambios locales
2. Backup de BD etiquetado `pre_update_TIMESTAMP`
3. Build de imágenes `backend` y `frontend` (postgres/redis intactos)
4. **Restore del backup** (DROP + CREATE DATABASE + restore) — el usuario admin viaja con el backup
5. `alembic upgrade head` sobre la BD restaurada (solo aplica migraciones nuevas)
6. Force-recreate de `backend` + `frontend`, restart de `proxy`, arranque de `ngrok`
7. Health check (curl a `/api/auth/login`, espera 401 ó 422)

Soporta `--dry-run` y escribe log de auditoría en `data/logs/update-safe.log`.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `docker/nginx/default.conf` | Corregir `proxy_pass`, añadir headers X-Forwarded, eliminar bloque n8n |
| `docker/nginx/default.prod.conf` | Vaciado (SSL no aplicable en despliegue actual con ngrok) |
| `docker-compose.yml` | ARG `VITE_API_URL` en frontend; añadir servicio `ngrok` |
| `frontend/Dockerfile` | ARG + ENV para `VITE_API_URL` en tiempo de build |
| `frontend/nginx.conf` | Añadir bloque `/api/` para proxy desde puerto 5173 |
| `backend/alembic/versions/20260419_0002_import_csv_data.py` | Deduplicación y filtro de columnas en `_bulk_upsert`; fix en `_import_quote_items` |
| `backend/app/services/sync_service.py` | Añadir `--skip-rollups` al subproceso |
| `scripts/update-safe.sh` | **NUEVO** — script de actualización segura |

---

## Notas de operación

- El estado de sincronización (`_state`) vive **en memoria** dentro del proceso backend.
  Si el contenedor se reinicia, el estado vuelve a `idle` automáticamente.
- La detección de cambios en CSV es por hash SHA-256; archivos sin cambios se omiten.
- Tras cualquier recreación del contenedor `backend`, ejecutar `docker compose restart proxy`.
- Para actualizar el stack: `./scripts/update-safe.sh`
- Para verificar sin ejecutar: `./scripts/update-safe.sh --dry-run`
