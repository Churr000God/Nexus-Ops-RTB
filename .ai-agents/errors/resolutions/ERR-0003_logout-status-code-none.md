# ERR-0003: Logout devuelve status_code None y rompe respuesta

**Fecha:** 2026-04-18
**Area:** backend
**Severidad:** medio
**Estado:** resuelto

## Descripcion
Al ejecutar `POST /api/auth/logout` se observaba error en runtime y el cliente no recibia respuesta valida:

- `KeyError: None` al construir la linea de status HTTP
- `TypeError: %d format: a real number is required, not NoneType` en access logger

## Contexto
- El endpoint devolvia el objeto `Response` inyectado por FastAPI.
- En algunos casos ese objeto no tenia `status_code` establecido (o quedaba en `None`) cuando se devolvia.

## Causa Raiz
Devolver un `Response` inyectado sin forzar `status_code` puede producir un estado inconsistente; Uvicorn/Starlette esperan un status code valido para serializar la respuesta.

## Solucion
- Construir y devolver explicitamente `Response(status_code=204)` y luego aplicar `delete_cookie`.

## Prevencion
- Para endpoints 204/empty body, preferir construir la respuesta explicitamente en lugar de reutilizar el response inyectado.

## Archivos Afectados
- `backend/app/routers/auth.py` — ajuste en `logout()`.
