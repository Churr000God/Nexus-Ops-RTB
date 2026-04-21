# Feature: Venta Promedio por Cliente (Locales vs Foráneos)

> Implementación de la métrica 3.2.1 del contexto de Ventas.

---

## Resumen

Se agregó al dashboard de Ventas un gráfico comparativo de barras que muestra el **monto promedio vendido por cliente**, desglosado por tipo de cliente (`Local` vs `Foráneo`).

**Restricción clave:** Solo considera cotizaciones con estado **Aprobada**.

---

## Backend

### Endpoint nuevo

```
GET /api/ventas/avg-sales-by-customer-type
```

**Query params:**
- `start_date` (opcional)
- `end_date` (opcional)

**Response:**
```json
[
  {
    "tipo_cliente": "Local",
    "numero_clientes": 12,
    "venta_promedio_por_cliente": 145000.50
  },
  {
    "tipo_cliente": "Foraneo",
    "numero_clientes": 8,
    "venta_promedio_por_cliente": 320000.00
  }
]
```

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/app/schemas/venta_schema.py` | Nuevo schema `AvgSalesByCustomerTypeResponse` |
| `backend/app/services/ventas_service.py` | Nuevo método `avg_sales_by_customer_type()` |
| `backend/app/routers/ventas.py` | Nuevo endpoint `/avg-sales-by-customer-type` |

### Lógica de cálculo

1. **CTE `ventas_por_cliente`**: calcula la suma de `Quote.subtotal` por cada cliente, filtrando solo cotizaciones aprobadas (`approved_on IS NOT NULL` o `status` contiene `"aprob"`).
2. **Agrupación final**: agrupa por `Customer.category` y calcula:
   - `COUNT(customer_id)` → número de clientes
   - `AVG(ventas_totales_cliente)` → venta promedio por cliente
3. **Filtro de fechas**: aplica sobre `Quote.created_on` / `Quote.created_at`.

> Nota: a diferencia del SQL original del requerimiento (que usaba la tabla `ventas`), esta implementación usa la tabla `cotizaciones` (`Quote`) porque el usuario especificó que solo se consideren cotizaciones aprobadas.

---

## Frontend

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/types/ventas.ts` | Nuevo type `AvgSalesByCustomerType` |
| `frontend/src/services/ventasService.ts` | Nuevo método `avgSalesByCustomerType()` |
| `frontend/src/components/dashboards/VentasDashboard.tsx` | Nuevo panel "Venta Promedio por Cliente" con gráfica de barras y tabla de detalle |

### UI

- **Gráfico de barras**: comparación directa Local vs Foráneo (eje Y en MXN).
- **Tabla de detalle**: muestra tipo de cliente, número de clientes y venta promedio.
- **Estados**: loading, error y empty state implementados.

---

## Corrección posterior: Ventas por Tipo de Cliente

El panel existente **"Ventas por Tipo de Cliente"** tenía una discrepancia: mostraba ~$833k cuando las ventas totales eran ~$3.48M.

### Causa
El método anterior (`sales_by_customer_type`) usaba la tabla `ventas` (Sale) con un `LEFT JOIN` a `cotizaciones`, pero el filtro `WHERE LOWER(COALESCE(c.status, '')) = 'aprobada'` descartaba todas las ventas que:
- No tuvieran `quote_id` vinculado.
- Tuvieran cotización con status diferente de `'aprobada'` exacto (por ejemplo `'Aprobada'` con mayúscula, `'approved'`, etc.).

### Solución aplicada
Se reescribió `sales_by_customer_type` para calcular directamente desde la tabla `cotizaciones` (`Quote`), sumando `Quote.subtotal` de cotizaciones aprobadas (usando `_approved_quote_condition()` que es más permisivo: `approved_on IS NOT NULL` o status contiene `"aprob"`).

Ahora ambos paneles ("Ventas por Tipo de Cliente" y "Venta Promedio por Cliente") usan la misma fuente de datos: **cotizaciones aprobadas**.

### Archivos afectados por la corrección
- `backend/app/services/ventas_service.py` — método `sales_by_customer_type` reescrito

## Verificación

- [x] Backend compila (`python -m py_compile`)
- [x] Frontend compila (`tsc --noEmit` y `vite build` exitosos)
- [x] Endpoint registrado en router de ventas
- [x] Hook integrado en estado global de carga/error del dashboard

---

## Commits sugeridos

```
feat(ventas): agrega venta promedio por cliente local vs foraneo

- Endpoint GET /api/ventas/avg-sales-by-customer-type
- Solo cotizaciones aprobadas (Quote.subtotal)
- Grafica de barras + tabla de detalle en dashboard
```
