# ERR-0021: 401 Unauthorized en delivery-notes — requestJson no inyectaba token automáticamente

**Fecha:** 2026-05-08
**Area:** frontend
**Severidad:** alto
**Estado:** resuelto

## Descripcion
```
GET http://localhost:8000/api/ventas-logistica/delivery-notes?limit=100 401 (Unauthorized)
```
La página de Notas de Remisión fallaba con 401 inmediatamente. El usuario estaba autenticado (GET /api/auth/me devolvía 200), pero delivery-notes fallaba en < 1ms sin tocar la base de datos.

## Contexto
`NotasRemisionPage.tsx` llama a `getDeliveryNotes()` de `ventasLogisticaService.ts`. Dicho servicio llama a `requestJson` sin pasar el `token`. El middleware de auth del backend (`auth_context_middleware`) sólo lee el header `Authorization`, nunca cookies. Sin header, `request.state.token_payload = None` → `get_current_user` lanza 401.

## Causa Raiz
`requestJson` en `frontend/src/lib/http.ts` sólo agregaba el header `Authorization: Bearer <token>` cuando el token se pasaba **explícitamente** en las opciones. La mayoría de los servicios (`ventasLogisticaService`, `comprasService`, etc.) llaman a `requestJson` sin pasar token. El token vive en el Zustand store persistido en `localStorage` bajo la clave `nexus-ops-auth`.

## Solucion
Se agregó `getStoredToken()` en `http.ts` que lee `localStorage.getItem("nexus-ops-auth")` y extrae `state.accessToken`. La lógica de resolución del token en `requestJson` y `requestBlob` cambió de:
```typescript
if (opts?.token) { headers.Authorization = ... }
```
a:
```typescript
const token = opts?.token ?? getStoredToken()
if (token) { headers.Authorization = ... }
```
Así, si se pasa token explícito se usa ese; si no, se usa el del store. No requiere cambios en ningún servicio.

## Prevencion
- Cualquier nuevo `requestJson` / `requestBlob` ya hereda el auto-token.
- Si se pasa `token: null` explícitamente, `getStoredToken()` hace fallback — correcto para rutas públicas que usan el mismo helper.

## Archivos Afectados
- `frontend/src/lib/http.ts` — añade `getStoredToken()`, usa `opts?.token ?? getStoredToken()` en ambas funciones

## Referencias
- Zustand persist key: `"nexus-ops-auth"` → `state.accessToken`
- Backend middleware: `backend/app/middleware/auth_middleware.py`
