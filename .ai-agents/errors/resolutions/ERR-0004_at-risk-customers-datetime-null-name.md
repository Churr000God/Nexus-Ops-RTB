# ERR-0004: CORS 500 en /at-risk-customers — datetime con tz + customer_name NULL

## Metadata
- **Fecha:** 2026-04-21
- **Area:** backend
- **Severidad:** alto
- **Estado:** resuelto

## Descripcion
`GET /api/ventas/at-risk-customers` devolvía 500, lo que causaba que el middleware CORS no añadiera la cabecera `Access-Control-Allow-Origin`, resultando en el error de CORS visible en el frontend.

## Causa Raiz
Dos errores encadenados en `ventas_service.py`:

1. **ValidationError Pydantic — campo `ultima_compra`:** La columna `MAX(v.sold_on)` devuelve `datetime` con timezone (`datetime.datetime(..., tzinfo=UTC)`), pero el schema `AtRiskCustomerResponse` declara `ultima_compra: date | None`. Pydantic 2 es estricto y no acepta datetime con tiempo no-cero para convertir a `date`.

2. **ValidationError Pydantic — campo `customer_name`:** El `LEFT JOIN clientes` devolvía `NULL` en `customer_name` para ventas sin cliente asociado, pero el schema lo declara como `str` (no opcional).

## Solucion
**`backend/app/services/ventas_service.py`**

1. Conversión explícita en Python al construir el response:
```python
ultima_compra=row.ultima_compra.date() if hasattr(row.ultima_compra, "date") else row.ultima_compra,
```

2. `COALESCE` en la query SQL para garantizar string no-nulo:
```sql
COALESCE(c.name, 'Sin cliente') AS customer_name,
```

El mismo fix preventivo se aplicó a `ultimo_pago` en `payment_trend` por la misma razón estructural.

## Patron a evitar
Cuando una columna de BD es `TIMESTAMP WITH TIME ZONE` y el schema Pydantic declara `date`, siempre convertir con `.date()` en el service antes de instanciar el schema. No confiar en la coerción automática de Pydantic 2.

## Referencias
- Pydantic error: `date_from_datetime_inexact`
- https://errors.pydantic.dev/2.13/v/date_from_datetime_inexact
