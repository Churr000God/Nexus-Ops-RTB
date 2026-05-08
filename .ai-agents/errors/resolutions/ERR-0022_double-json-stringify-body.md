# ERR-0022: 422 Unprocessable Entity en POST delivery-notes — doble serialización JSON

**Fecha:** 2026-05-08
**Area:** frontend
**Severidad:** alto
**Estado:** resuelto

## Descripcion
```
POST http://localhost:8000/api/ventas-logistica/delivery-notes 422 (Unprocessable Entity)
```
Crear una Nota de Remisión fallaba con 422. El error ocurrió inmediatamente después de resolver ERR-0021 (los POSTs antes llegaban bloqueados por 401).

## Contexto
`ventasLogisticaService` (y también `comprasService`, `cfdiService`, `assetsService`, etc.) llaman a `requestJson` con `body: JSON.stringify(data)` (cuerpo ya serializado). `requestJson` en `http.ts` también llamaba `JSON.stringify(opts.body)` internamente. El servidor recibía una cadena JSON entre comillas (`"{\\"customer_id\\":1,...}"`) en lugar de un objeto JSON → FastAPI no podía parsear el body como el modelo Pydantic → 422.

## Causa Raiz
Doble serialización: los servicios serializan el body con `JSON.stringify` antes de pasarlo a `requestJson`, y `requestJson` volvía a serializar el valor con `JSON.stringify`, produciendo un string escapado. La función `authService` (que sí funciona) pasa objetos crudos, no strings pre-serializados.

## Solucion
En `frontend/src/lib/http.ts`, la línea que construye el body del `fetch` cambió de:
```typescript
body: opts?.body ? JSON.stringify(opts.body) : undefined,
```
a:
```typescript
body: opts?.body
  ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body))
  : undefined,
```
Si el body ya es un string, se usa directamente. Si es un objeto/valor, se serializa. Esto corrige todos los servicios afectados sin tocarlos.

## Prevencion
- Pasar siempre objetos crudos a `requestJson` (no pre-serializar con `JSON.stringify`).
- La lógica de serialización vive únicamente en `requestJson`; los servicios no deben duplicarla.

## Archivos Afectados
- `frontend/src/lib/http.ts` — detección de body pre-serializado en `requestJson`

## Servicios afectados (que pasaban body pre-serializado)
- `ventasLogisticaService` — todos los POST/PATCH
- `comprasService` — todos los POST/PATCH
- `cfdiService`, `assetsService`, `clientesProveedoresService`, etc.
