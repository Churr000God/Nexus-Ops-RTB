# ERR-0007: ruff F821 — Undefined name RecentQuoteResponse en router de ventas

**Fecha:** 2026-04-21
**Area:** backend
**Severidad:** bajo
**Estado:** resuelto

## Descripcion
`ruff check .` falla con:

```
app/routers/ventas.py:186:51: F821 Undefined name `RecentQuoteResponse`
app/routers/ventas.py:194:11: F821 Undefined name `RecentQuoteResponse`
```

## Contexto
Se agrego un nuevo endpoint en `app/routers/ventas.py` y se ajustaron imports de `app.schemas.venta_schema`. Al correr linters, `ruff` detecto que un tipo usado en type hints no estaba importado en el modulo.

## Causa Raiz
`RecentQuoteResponse` se usa en el decorador `response_model` y en el type hint de retorno, pero se elimino accidentalmente del bloque de imports desde `app.schemas.venta_schema`.

## Solucion
1. Agregar `RecentQuoteResponse` al import en `app/routers/ventas.py`.
2. Ejecutar `ruff check .` para confirmar que el modulo queda consistente.

## Prevencion
- Correr `ruff check .` despues de modificar routers para detectar de inmediato referencias no importadas.
- Evitar ediciones manuales del bloque de imports sin verificacion automatica (lint/typecheck) al final.

## Archivos Afectados
- `backend/app/routers/ventas.py` — se restauro el import de `RecentQuoteResponse`

