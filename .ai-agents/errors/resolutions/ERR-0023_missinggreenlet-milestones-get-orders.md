# ERR-0023: MissingGreenlet en GET /orders — milestones sin eager-load

**Fecha:** 2026-05-08
**Area:** backend
**Severidad:** alto
**Estado:** resuelto

## Descripcion
`GET /api/ventas-logistica/orders?limit=150` retornaba 500 → CORS bloqueaba la respuesta.

```
fastapi.exceptions.ResponseValidationError: 1 validation errors:
  {'type': 'get_attribute_error', 'loc': ('response', 0, 'milestones'),
   'msg': "MissingGreenlet: greenlet_spawn has not been called; can't call await_only() here."}
```

## Causa Raiz
`get_orders()` usaba `selectinload(Order.items)` pero NO `selectinload(Order.milestones)`.
Al serializar `OrderOut` (que incluye `milestones: list[OrderMilestoneResponse]`), SQLAlchemy intentaba hacer lazy-load fuera de un contexto async → MissingGreenlet.

## Solucion
```python
# ventas_logistica_service.py — get_orders()
q = select(Order).options(
    selectinload(Order.items),
    selectinload(Order.milestones),  # ← agregado
)
```
También se cambió `update_order` para retornar via `get_order()` (que ya carga ambas relaciones) en lugar de `db.refresh(order)`.

## Regla
Cada vez que se añade una relación a un schema de respuesta, verificar que TODAS las funciones que retornan ese modelo tengan el `selectinload` correspondiente.
