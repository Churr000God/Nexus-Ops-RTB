# Inventario — Lógica de cálculo y migración pendiente

> Documento generado el 2026-04-27. Captura las decisiones de diseño validadas por el usuario
> y el estado exacto de la migración de datos pendiente.

---

## 1. Fórmulas de inventario (CONFIRMADAS POR EL USUARIO)

### Relación base
```
productos.id  ←→  inventario.product_id   (1-a-1)
```

### Stock real

| Campo | Fórmula | Fuente |
|-------|---------|--------|
| `inbound_real` | `SUM(entradas_mercancia.qty_arrived)` | join `em.product_id = productos.id` |
| `outbound_real` | `SUM(cotizacion_items.qty_packed WHERE quote_status = 'Aprobada')` | join `ci.product_id = productos.id` |
| `nonconformity_adj` | `SUM(no_conformes.inventory_adjustment)` | join `nc.product_id = productos.id` |
| **`real_qty`** | `inbound_real - outbound_real ± nonconformity_adj` | — |
| **`monto_real`** | `real_qty × productos.unit_price` | precio SIEMPRE de `productos.unit_price` |

### Stock teórico

| Campo | Fórmula | Fuente |
|-------|---------|--------|
| `inbound_theoretical` | `SUM(solicitudes_material.qty_requested)` (lo que se necesita) | join `sm.product_id = productos.id` |
| `gap_solicitud` | `solicitudes_material.qty_requested - entradas_mercancia.qty_requested` | cantidad que falta pedir a otro proveedor |
| `inbound_theoretical_total` | `entradas_mercancia.qty_requested + gap_solicitud` = `solicitudes_material.qty_requested` | simplificado: es solo `solicitudes_material.qty_requested` |
| `outbound_theoretical` | `SUM(cotizacion_items.qty_requested WHERE quote_status = 'Aprobada')` | join `ci.product_id = productos.id` |
| **`theoretical_qty`** | `inbound_theoretical - outbound_theoretical` | — |
| **`monto_teorico`** | `theoretical_qty × productos.unit_price` | — |

**Explicación del gap (ejemplo del usuario):**
- Solicitud de material pide 100 unidades
- Entrada de mercancía tiene 80 en `qty_requested`
- Gap = 100 - 80 = 20 (hay que pedir 20 más a otro proveedor)
- `inbound_theoretical` = 80 + 20 = 100 = lo que marca `solicitudes_material.qty_requested`
- ∴ la fórmula simplificada es: `inbound_theoretical = SUM(solicitudes_material.qty_requested)`

### `movimientos_inventario`
**SOLO para validar fechas** (última entrada/salida). No se usa para calcular cantidades.

### Precio
`productos.unit_price` es la única fuente. `inventario.unit_cost` está NULL para todos los registros.
`proveedor_productos.avg_price` puede usarse como último fallback visual pero no para cálculos de rollup.

---

## 2. Función `recompute_inventory_rollups` — versión CORRECTA (pendiente de migrar)

La versión actual en `scripts/bootstrap_triggers.sql` y migración `0009` es INCORRECTA porque:
- Usa `movimientos_inventario` para las cantidades (debería ser solo para fechas)
- El teórico usa `entradas_mercancia` en vez de `solicitudes_material`

La función correcta a implementar:

```sql
CREATE OR REPLACE FUNCTION app.recompute_inventory_rollups(p_inventory_id uuid)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
    v_product_id uuid;
BEGIN
    SELECT product_id INTO v_product_id
    FROM inventario WHERE id = p_inventory_id;

    UPDATE inventario i
    SET
        inbound_real             = COALESCE(real_in.v,  0),
        outbound_real            = COALESCE(real_out.v, 0),
        inbound_theoretical      = COALESCE(th_in.v,   0),
        outbound_theoretical     = COALESCE(th_out.v,  0),
        nonconformity_adjustment = COALESCE(nc.v,      0),
        real_qty      = COALESCE(real_in.v, 0)  - COALESCE(real_out.v, 0)  + COALESCE(nc.v, 0),
        theoretical_qty = COALESCE(th_in.v, 0) - COALESCE(th_out.v, 0),
        stock_diff    = (COALESCE(real_in.v, 0)  - COALESCE(real_out.v, 0)  + COALESCE(nc.v, 0))
                      - (COALESCE(th_in.v, 0)   - COALESCE(th_out.v, 0)),
        stock_total_cost = (COALESCE(real_in.v, 0) - COALESCE(real_out.v, 0) + COALESCE(nc.v, 0))
                         * COALESCE(pr.unit_price, 0)
    FROM productos pr,
    LATERAL (SELECT COALESCE(SUM(qty_arrived), 0) AS v
             FROM entradas_mercancia WHERE product_id = v_product_id) AS real_in,
    LATERAL (SELECT COALESCE(SUM(qty_packed), 0) AS v
             FROM cotizacion_items
             WHERE product_id = v_product_id
               AND LOWER(COALESCE(quote_status, '')) LIKE '%aprob%') AS real_out,
    LATERAL (SELECT COALESCE(SUM(qty_requested), 0) AS v
             FROM solicitudes_material WHERE product_id = v_product_id) AS th_in,
    LATERAL (SELECT COALESCE(SUM(qty_requested), 0) AS v
             FROM cotizacion_items
             WHERE product_id = v_product_id
               AND LOWER(COALESCE(quote_status, '')) LIKE '%aprob%') AS th_out,
    LATERAL (SELECT COALESCE(SUM(inventory_adjustment), 0) AS v
             FROM no_conformes WHERE product_id = v_product_id) AS nc
    WHERE i.id = p_inventory_id
      AND pr.id = v_product_id;
END;
$fn$;
```

---

## 3. Estado actual de los datos (2026-04-27)

### FKs nulas — problema crítico

| Tabla | Filas totales | `product_id = NULL` |
|-------|--------------|---------------------|
| `entradas_mercancia` | 1 592 | **1 592** (100%) |
| `solicitudes_material` | 909 | **909** (100%) |
| `inventario` | 1 568 | **1 557** (99%) |

Las tablas fueron importadas desde Notion CSV pero el paso de resolución de UUID FK nunca se completó.

### Tasa de resolución con claves naturales

| Tabla | Llave natural | Matches | Total | % |
|-------|--------------|---------|-------|---|
| `solicitudes_material` | `product_sku = productos.sku` | 860 | 909 | 95% |
| `entradas_mercancia` | `external_product_id → cotizacion_items.external_product_id → product_id` | 1 260 | 1 592 | 79% |
| `inventario` | `internal_code = productos.sku` | 69 | 1 568 | 4% (resto se resolverá por join transitivo una vez que las otras tablas tengan FK) |

### Totales validados (usando joins por llave natural, sin FKs)

| Métrica | Valor |
|---------|-------|
| Monto total stock real | **$10,727,795.46 MXN** |
| Monto total stock teórico | **$669,268.45 MXN** |
| Productos con datos | 904 |
| Precio: fuente usada | `productos.unit_price` |

---

## 4. Tarea pendiente — Migración de datos

### Orden de ejecución

1. **Backfill `solicitudes_material.product_id`**
   ```sql
   UPDATE solicitudes_material sm
   SET product_id = p.id
   FROM productos p
   WHERE p.sku = sm.product_sku
     AND sm.product_id IS NULL;
   -- Resultado esperado: ~860 filas actualizadas
   ```

2. **Backfill `entradas_mercancia.product_id`**
   ```sql
   UPDATE entradas_mercancia em
   SET product_id = ci.product_id
   FROM (
       SELECT DISTINCT ON (external_product_id) external_product_id, product_id
       FROM cotizacion_items
       WHERE product_id IS NOT NULL AND external_product_id IS NOT NULL
       ORDER BY external_product_id, created_at DESC
   ) ci
   WHERE ci.external_product_id = em.external_product_id
     AND em.product_id IS NULL;
   -- Resultado esperado: ~1260 filas actualizadas
   ```

3. **Backfill `inventario.product_id`** (vía sku + transitivo)
   ```sql
   -- Paso A: por internal_code = sku
   UPDATE inventario i
   SET product_id = p.id
   FROM productos p
   WHERE p.sku = i.internal_code
     AND i.product_id IS NULL;
   
   -- Paso B: filas sin resolver — requieren CSV o revisión manual
   -- (las ~1488 restantes probablemente tengan internal_code no reconocible)
   ```

4. **Actualizar función `recompute_inventory_rollups`** con fórmulas correctas (ver §2)

5. **Ejecutar rollup para todos los productos**
   ```sql
   SELECT app.recompute_inventory_rollups(id) FROM inventario;
   SELECT app.recompute_product_rollups(id)   FROM productos;
   ```

6. **Actualizar `inventario_service.py`** para usar `productos.unit_price`:
   ```python
   # Reemplazar COALESCE(i.unit_cost, pc.avg_price_prov) por:
   p.unit_price AS costo_unitario
   # y eliminar el CTE prov_costo si ya no se usa
   ```

### Cuándo usar CSV
Si el usuario re-envía los CSV originales de Notion, usar el campo `Producto → ID` (external_id) de cada CSV para resolver product_id directamente, en lugar del puente por external_product_id (más confiable).

---

## 5. Migraciones ya aplicadas (sesión 2026-04-27)

| Revision | Cambios |
|----------|---------|
| `20260427_0009` | Fix `recompute_product_rollups` (sin fallback `q.created_on`); fix `recompute_inventory_rollups` (fuentes correctas aunque aún no usa `solicitudes_material`); trigger `trg_ventas_period_fields`; backfill `year_month`/`quadrimester` |

> La migración `0009` mejora el estado pero **no implementa la fórmula final** de inventario.
> La migración correcta queda pendiente para después del backfill de FKs.

---

## 6. Otros cambios aplicados en esta sesión

| Archivo | Cambio |
|---------|--------|
| `backend/app/services/rollups/abc.py` | Corregido: ahora lee `productos.total_accumulated_sales` via JOIN (antes leía campo inexistente en `inventario`) |
| `backend/app/services/inventario_service.py` | Cambiado de INNER JOIN a LEFT JOIN con `proveedor_productos`; usa `COALESCE(i.unit_cost, pc.avg_price_prov)` (pendiente cambiar a `productos.unit_price`) |
| `backend/app/services/ventas_service.py` | Fix signo `diff_vs_po`; estandarizados 5 comparadores de status a `LOWER(COALESCE(...)) LIKE '%aprob%'` |
| `docs/estructura_bd_rtb.md` | Corregido formato `year_month` de `'TMMonth YYYY'` a `'YYYY-MM'` |
| `scripts/bootstrap_triggers.sql` | Fix `last_outbound_date` sin fallback; fix inventory rollup con fuentes correctas; nuevo trigger ventas |
