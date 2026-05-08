# ERR-0024: inventory_movements contaminaba stock real con movimientos teóricos de NR

**Fecha:** 2026-05-08
**Area:** backend+db
**Severidad:** medio
**Estado:** resuelto

## Descripcion
Al aprobar una NR, el servicio insertaba un `InventoryMovement(movement_type="Salida")` en la tabla `inventory_movements`. La vista `v_inventory_current` calcula `quantity_on_hand = SUM(qty_in) - SUM(qty_out)` sobre TODOS los registros de esa tabla sin filtrar por tipo. Resultado: la columna **Stock Real** en la página de Inventario mostraba valores negativos para SKUs incluidos en NRs aprobadas, aunque ningún producto había salido físicamente del almacén.

Ejemplo observado: SV-869 con Stock Real = -4 después de aprobar NR-2026-00001.

## Causa Raiz
Diseño incorrecto de dos flujos mezclados en la misma tabla:
- `inventory_movements` es la tabla de movimientos **físicos** (empaque, recepciones).
- El servicio `create_delivery_note` (y luego `update_delivery_note`) insertaba movimientos de tipo "Salida" al crear/aprobar una NR, que es un evento **teórico** (compromiso de venta, no salida física).
- `v_inventory_current` no distingue entre movimientos teóricos y reales.

## Solucion
**Arquitectura de dos niveles establecida:**

| Nivel | Tabla | Qué mide |
|-------|-------|----------|
| Teórico | `inventario.outbound_theoretical` / `theoretical_qty` | Demanda comprometida en NRs APROBADAS |
| Real | `inventory_movements` + `inventario.outbound_real` / `real_qty` | Movimientos físicos al empacar |

**Cambios en `ventas_logistica_service.py`:**
1. Eliminado el bloque `InventoryMovement` insert de `create_delivery_note` y de `update_delivery_note`.
2. En `update_delivery_note`, al transicionar a APROBADA: solo `UPDATE inventario SET outbound_theoretical += qty, theoretical_qty -= qty`.
3. En `update_delivery_note`, al transicionar a CANCELADA desde APROBADA: `UPDATE inventario SET outbound_theoretical -= qty` para revertir.
4. En `pack_order_item`: se mantiene `InventoryMovement` insert (único lugar correcto para movimientos reales).

**Backfill en Supabase:**
- Eliminados los movimientos contaminantes insertados por `create_delivery_note`.
- Insertado movimiento correcto para NR-2026-00001 en `inventory_movements` con `gen_random_uuid()` y `NOW()` explícitos (columnas sin default en DB).
- Actualizado `inventario.outbound_theoretical` para los productos de NR-2026-00001 (SV-869 → 4, RV-1350 → 3).
- Actualizado `order_milestones` para PED-2026-00002 con columna correcta `occurred_at` (no `reached_at`).

## Regla
`inventory_movements` es solo para movimientos físicos (packing, recepciones GR). Los compromisos teóricos van en `inventario.outbound_theoretical`. Nunca insertar `InventoryMovement` desde flujos de NR (crear, aprobar, cancelar).

## Archivos Afectados
- `backend/app/services/ventas_logistica_service.py` — eliminados inserts de InventoryMovement en flujos NR; movidos a pack_order_item
