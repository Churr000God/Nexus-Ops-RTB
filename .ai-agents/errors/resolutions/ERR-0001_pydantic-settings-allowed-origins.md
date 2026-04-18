# ERR-0001: Pydantic Settings no parsea ALLOWED_ORIGINS desde env

**Fecha:** 2026-04-18
**Area:** backend
**Severidad:** medio
**Estado:** resuelto

## Descripcion
Al ejecutar Alembic o iniciar el backend, se produjo un error al cargar settings:

- `pydantic_settings.exceptions.SettingsError: error parsing value for field "ALLOWED_ORIGINS" from source "EnvSettingsSource"`
- `json.decoder.JSONDecodeError: Expecting value`

## Contexto
- Se intento modelar `ALLOWED_ORIGINS` como `list[str]` en settings y cargarlo desde `.env` con un valor CSV: `http://localhost:5173,http://localhost`.
- Ocurrio durante `alembic upgrade head` y arranque del backend.

## Causa Raiz
`pydantic-settings` puede tratar campos complejos (listas/dicts) como JSON al cargarlos desde variables de entorno; un CSV no es JSON valido, por lo que falla el parseo.

## Solucion
- Cambiar `ALLOWED_ORIGINS` a `str` en settings.
- Exponer `allowed_origins_list` como propiedad que hace split por coma y trim.
- Ajustar CORS middleware para usar `settings.allowed_origins_list`.

## Prevencion
- Para arrays simples configurados via `.env`, preferir `str` + parseo manual (CSV).
- Reservar `list[str]` via env solo cuando el valor vaya a ser JSON (p.ej. `["a","b"]`).

## Archivos Afectados
- `backend/app/config.py` — cambio de tipo/parsing.
- `backend/app/middleware/cors.py` — consumo de `allowed_origins_list`.

## Referencias
- Pydantic Settings (env parsing de tipos complejos) — comportamiento observado en runtime.
