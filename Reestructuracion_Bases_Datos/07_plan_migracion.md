# Plan de migración Notion + n8n → PostgreSQL

## Estrategia

Migración **big-bang con periodo de paralelización**. Durante 2-4 semanas el sistema viejo y el nuevo conviven; al final, un cutover formal.

```
┌───────────────────────────────────────────────────────────────┐
│  FASE 1: PREPARACIÓN          (sem 1-2)                       │
│  → Provisionar PG, deploy schema + views/triggers              │
│  → Cargar catálogos SAT (claves producto/unidad/régimen, etc.) │
│  → Construir scripts ETL                                       │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│  FASE 2: CARGA INICIAL        (sem 3)                         │
│  → Export Notion → JSON / CSV                                  │
│  → ETL: catálogos, clientes, proveedores, productos           │
│  → ETL: cotizaciones, pedidos, compras (cerrados ya migrados)  │
│  → ETL: inventario actual como OPENING_BALANCE                 │
│  → Validación de integridad                                    │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│  FASE 3: PARALELIZACIÓN       (sem 4-5)                       │
│  → Operación se sigue en Notion (autoritativo)                 │
│  → n8n replica deltas a PG                                     │
│  → Equipo se entrena en sistema nuevo                          │
│  → Reconciliación diaria (reporte de divergencias)             │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│  FASE 4: CUTOVER              (sem 6, fin de semana)          │
│  → Freeze Notion                                               │
│  → Última sincronización delta                                 │
│  → PG pasa a ser autoritativo                                  │
│  → Notion queda solo lectura por 90 días                       │
└───────────────────────────────────────────────────────────────┘
```

---

## Orden de carga (importa por las FKs)

```
NIVEL 0 — Catálogos SAT (datos públicos del SAT)
  sat_product_keys, sat_unit_keys, sat_tax_regimes,
  sat_cfdi_uses, sat_payment_methods, sat_payment_forms

NIVEL 1 — Seguridad
  users, roles, permissions, role_permissions, user_roles

NIVEL 2 — Catálogos de negocio
  brands, categories
  → products
  → product_attributes, product_attribute_options
  → bom, bom_items
  → product_prices

NIVEL 3 — Entidades comerciales
  customers   →  customer_tax_data, customer_addresses, customer_contacts
  suppliers   →  supplier_tax_data, supplier_addresses, supplier_contacts
              →  supplier_products

NIVEL 4 — Inventario inicial
  inventory_movements (tipo OPENING_BALANCE) — saldo inicial al corte

NIVEL 5 — Histórico de transacciones (orden cronológico)
  quotes  →  quote_items  →  quote_status_history
  orders  →  order_items  →  order_milestones
  purchase_requests → purchase_request_items
  purchase_orders   → purchase_order_items
  supplier_invoices → supplier_invoice_items
  goods_receipts    → goods_receipt_items   (no disparar trigger en migración)
  non_conformities

NIVEL 6 — Movimientos derivados (sin trigger; se insertan directo desde el histórico)
  inventory_movements (RECEIPT, ISSUE, ADJUSTMENT_*) reconstruidos del histórico
                      o consolidados como OPENING_BALANCE si no hay detalle suficiente

NIVEL 7 — Facturación histórica (si existe)
  cfdi → cfdi_items → cfdi_credit_notes → cfdi_payments
  payments → payment_applications

NIVEL 8 — Otros
  operating_expenses
  inventory_snapshots (mes a mes desde el histórico)
```

> **Crítico:** durante la migración, deshabilitar los triggers de inventario (`fn_create_inv_movement_from_receipt`, `fn_create_inv_movement_from_packing`, `fn_create_inv_movement_from_nc`) o usar `ALTER TABLE ... DISABLE TRIGGER USER` en las tablas afectadas. Los movimientos ya vienen del histórico — no se deben duplicar.

---

## Mapeo Notion → PostgreSQL (tabla por tabla)

### Catálogo de Productos → `products`

| Notion (raw) | Notion (normalizado) | PostgreSQL |
|---|---|---|
| `property_sku` | SKU | `sku` |
| `property_codigo_interno[0]` | Código interno | `internal_code` |
| `property_nombre_del_producto` | Nombre del producto | `name` |
| `property_descripci_n` | Descripción | `description` |
| `property_marca[0]` | Marca | `brand_id` (lookup en `brands` por nombre) |
| `property_categor_a[0]` | Categoría | `category_id` (lookup) |
| `property_tama_o_del_paquete` | Tamaño del paquete | `package_size` |
| `property_status` | Status | `is_active = (status = 'Activo')` |
| `property_precio_unitario` | Precio unitario | `product_prices.unit_price` (con `is_current=TRUE`) |

### Directorio de Ubicaciones → `customers` y `suppliers`

Filtrar por `property_tipo`:
- `Tipo = 'Cliente'` → carga en `customers` + `customer_tax_data` + `customer_addresses`
- `Tipo = 'Proveedor'` → carga en `suppliers` + `supplier_tax_data` + `supplier_addresses`

| Notion (raw) | PostgreSQL |
|---|---|
| `property_siglas_id` | `customers.code` / `suppliers.code` |
| `property_nombre_del_cliente` | `business_name` |
| `property_rfc` | `customer_tax_data.rfc` / `supplier_tax_data.rfc` |
| `property_raz_n_social` ⚠ | **`legal_name`** (¡no Dirección como dice el bug!) |
| `property_contacto_principal`, `property_email`, `property_tel_fono` | `*_contacts` con `is_primary=TRUE` |
| `property_tpp` | `suppliers.avg_payment_time_days` (parsear texto) |

> Resolver el bug `raz_n_social → Dirección`: extraer la dirección física de un campo distinto si existe, o capturarla manualmente en `customer_addresses`/`supplier_addresses`.

### Proveedores y Productos → `supplier_products`

| Notion | PostgreSQL |
|---|---|
| `property_id_del_producto[0]` | `product_id` (lookup por SKU) |
| `property_id_del_proveedor[0]` | `supplier_id` (lookup por código) |
| `property_precio_mxn` | `unit_cost` (currency='MXN') |
| `property_disponibilidad` | `is_available` |
| `property_fecha_de_actualizaci_n` | `valid_from`; `valid_to=NULL`, `is_current=TRUE` |

### Cotizaciones a Clientes → `quotes`

| Notion | PostgreSQL |
|---|---|
| `$json.id` | `notion_id` (columna auxiliar para reconciliación, no en DDL final) |
| `$json.name` | `quote_number` |
| `property_estado` + `property_estado_del_pedido_auto` | mapear a `status` (DRAFT/SENT/APPROVED/REJECTED/CANCELLED/EXPIRED) |
| `property_id_de_c_liente[0]` | `customer_id` (lookup) |
| `property_fecha_de_creaci_n` | `issue_date` |
| `property_fecha_de_aprobaci_n` | `approval_date` |
| `property_seguimiento.start` | `follow_up_date` |
| `property_total` | `total` (será recalculado por trigger; preservar en columna staging para validar) |
| `property_descuento`, `property_costo_de_envio` | `discount_amount`, `shipping_amount` |
| `property_credito`, `property_meses` | `requires_credit`, `credit_months` |

Las **Cotizaciones Canceladas** se cargan a `quotes` con `status='CANCELLED'`, `cancellation_reason` y `cancelled_at` desde la tabla origen. **No se crea tabla aparte.**

### Detalles de Cotizaciones → `quote_items`

| Notion | PostgreSQL |
|---|---|
| `property_de_partida` | `line_number` |
| `property_cotizaciones_a_clientes[0]` | `quote_id` (lookup) |
| `property_sku[0]` | `product_id` (lookup por SKU) |
| `property_cantidad_solicitada` | `quantity_requested` |
| `property_cantidad_empacada` | `quantity_packed` |
| `property_costo_unitario_v` | `unit_price_sale` |
| `property_costo_unitario_de_compra_formula` | `unit_cost_purchase` |

### Pedidos de Clientes → `orders`

| Notion | PostgreSQL |
|---|---|
| `property_cotizacion[0]` | `quote_id` (lookup; relación 1:1) |
| `property_estado_de_pedido` | `status` |
| `property_estatus_de_pago` | `payment_status` |
| `property_estado_de_factura` | `invoice_status` |
| `property_tiene_faltante` | `has_shortage` |
| `property_fecha_de_pedido` ... `property_fecha_de_pago` | columnas equivalentes |
| `property_responsable_de_surtido[0]` | `fulfillment_user_id` (lookup en `users` por nombre) |

**Pedidos Incompletos** NO se migra: es la misma data que `orders`, filtrada por `has_shortage=TRUE` (ahora vista `v_orders_with_shortage`).

### Verificador de fechas pedidos → `order_milestones`

Una fila por hito: `(order_id, milestone_type, milestone_date)`.

### Reporte de Ventas → NO MIGRAR

Se reconstruye desde la vista `v_sales_report`. Si el equipo de finanzas necesita la versión histórica congelada, se puede materializar como `sales_report_archive` antes del cutover.

### Solicitudes de Material → `purchase_request_items`

Cada renglón se vuelve un `purchase_request_items`. Las solicitudes se agrupan en un `purchase_requests` por fecha + responsable + lote (definir criterio).

### Solicitudes A Proveedores → `purchase_orders` + `purchase_order_items`

| Notion | PostgreSQL |
|---|---|
| `property_folio_de_pedido` | `po_number` |
| `property_proveedor[0]` | `supplier_id` |
| Estados | mapear a enum |
| `property_total`, `property_iva`, `property_envio` | `total`, `tax_amount`, `shipping_amount`. `subtotal = total - iva - envio` (preservar). |
| `property_productos_solicitados` (array serializado) | parsear JSON, generar partidas |

### FACTURAS COMPRAS → `supplier_invoices`

| Notion | PostgreSQL |
|---|---|
| `property_de_factura` | `invoice_number` |
| `property_de_cotizacion` | `supplier_quote_number` |
| `property_proveedor[0]` | `supplier_id` |
| `property_subtotal_f`, `property_iva_16`, `property_total` | columnas equivalentes |
| `property_costo_de_envio`, `property_seguro`, `property_descuento` | columnas equivalentes |
| `property_status_de_pago`, `property_estatus_de_factura` | `payment_status`, `status` |
| `property_responsable_de_revision_de_material[0]` | `review_user_id` |

### Entradas de Mercancía → `goods_receipts` + `goods_receipt_items`

**Crítico**: deshabilitar `trg_inv_from_receipt` durante la carga. Los movimientos de inventario se cargan por separado desde el histórico (Bitácora).

### Gestión de Inventario → NO migrar (es vista)

Se reemplaza por `v_inventory_current` y `v_inventory_kpis`. Para asegurar que el saldo coincida tras la migración, se compara `v_inventory_current.quantity_on_hand` con el campo Notion `property_cantidad_real_en_inventario` y se ajusta con `inventory_movements` tipo `ADJUSTMENT_IN/OUT` si hay diferencia.

### Bitácora de Movimientos → `inventory_movements`

| Notion | PostgreSQL |
|---|---|
| `property_tipo_de_movimiento` | mapear a `movement_type` (Entrada→RECEIPT, Salida→ISSUE, NC→ADJUSTMENT_*) |
| `property_cantidad_entrante` | `quantity_in` |
| `property_cantidad_salida` | `quantity_out` |
| `property_cantidad_por_no_conformidad` | a `quantity_in` o `quantity_out` según el tipo |
| `property_referencia_entrada[0]` / `property_referencia_salida[0]` | `source_type` + `source_id` (resolver por lookup) |
| `property_fecha_y_hora` | `occurred_at` |

> **Si no hay detalle histórico fiable de movimientos**: cargar un único `OPENING_BALANCE` por SKU con la cantidad actual al corte, en vez de reconstruir todo. Es más limpio.

### No Conformes → `non_conformities`

Cargar normal. Triggers deshabilitados durante migración; los `inventory_movements` correspondientes se cargan desde Bitácora (no se duplican).

### Gastos Operativos → `operating_expenses`

Mapeo directo.

### Crecimiento de Inventario → `inventory_snapshots`

Cada fila se vuelve un snapshot mensual.

---

## Scripts ETL — esqueleto

```python
# etl/01_load_catalogs_sat.py
import psycopg2, csv

# Cargar catálogos SAT desde CSV oficial
# Disponibles en: http://omawww.sat.gob.mx/tramitesyservicios/Paginas/catalogos_emision_cfdi.htm
def load_sat_keys():
    conn = psycopg2.connect(DSN)
    with open('catalogo_sat/c_ClaveProdServ.csv') as f:
        reader = csv.DictReader(f)
        with conn.cursor() as cur:
            for row in reader:
                cur.execute("""
                    INSERT INTO rtb.sat_product_keys (sat_code, description)
                    VALUES (%s, %s) ON CONFLICT (sat_code) DO NOTHING
                """, (row['c_ClaveProdServ'], row['Descripcion']))
    conn.commit()
```

```python
# etl/02_load_products.py
import requests, psycopg2

NOTION_TOKEN = "..."
DB_PRODUCTOS = "..."

def fetch_notion_db(db_id):
    # Paginar todas las filas
    headers = {"Authorization": f"Bearer {NOTION_TOKEN}", "Notion-Version": "2022-06-28"}
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    has_more, cursor, results = True, None, []
    while has_more:
        body = {"page_size": 100}
        if cursor: body["start_cursor"] = cursor
        r = requests.post(url, headers=headers, json=body)
        data = r.json()
        results.extend(data["results"])
        has_more = data["has_more"]; cursor = data.get("next_cursor")
    return results

def normalize(props):
    # Aplica el mismo nodo Set del normalizador de n8n
    # ...
    return {...}

def load_products():
    rows = fetch_notion_db(DB_PRODUCTOS)
    conn = psycopg2.connect(DSN)
    with conn.cursor() as cur:
        for r in rows:
            n = normalize(r["properties"])
            cur.execute("""
                INSERT INTO rtb.products
                  (sku, internal_code, name, description, brand_id, category_id, package_size, is_active)
                VALUES (%s, %s, %s, %s,
                        (SELECT brand_id FROM rtb.brands WHERE name = %s),
                        (SELECT category_id FROM rtb.categories WHERE name = %s),
                        %s, %s)
                ON CONFLICT (sku) DO UPDATE SET
                  name = EXCLUDED.name,
                  description = EXCLUDED.description,
                  updated_at = now()
            """, (n["sku"], n["codigo_interno"], n["nombre_producto"], n["descripcion"],
                  n["marca"], n["categoria"], n["tamano_paquete"], n["status"] == "Activo"))
    conn.commit()
```

Repetir el patrón para cada tabla, en el orden definido arriba. Entregar como repo Python con tests por entidad.

---

## Validaciones post-migración

Ejecutar como `psql -f validate.sql` y revisar el reporte:

```sql
-- 1. Cuentas: cada Notion DB → tabla PG correspondiente
SELECT 'products' AS tabla, COUNT(*) FROM rtb.products
UNION ALL SELECT 'customers', COUNT(*) FROM rtb.customers
UNION ALL SELECT 'suppliers', COUNT(*) FROM rtb.suppliers
UNION ALL SELECT 'quotes', COUNT(*) FROM rtb.quotes
UNION ALL SELECT 'orders', COUNT(*) FROM rtb.orders
UNION ALL SELECT 'purchase_orders', COUNT(*) FROM rtb.purchase_orders
UNION ALL SELECT 'supplier_invoices', COUNT(*) FROM rtb.supplier_invoices
UNION ALL SELECT 'inventory_movements', COUNT(*) FROM rtb.inventory_movements;

-- 2. Integridad: cotizaciones sin partidas
SELECT q.quote_id, q.quote_number FROM rtb.quotes q
LEFT JOIN rtb.quote_items qi ON qi.quote_id = q.quote_id
WHERE qi.quote_item_id IS NULL;

-- 3. Pedidos sin cotización (no debería haber)
SELECT * FROM rtb.orders WHERE quote_id IS NULL;

-- 4. SKUs con stock negativo (problema de mapeo)
SELECT * FROM rtb.v_inventory_current WHERE quantity_on_hand < 0;

-- 5. Total de cotización ≠ suma de partidas (tolerancia 0.01)
SELECT q.quote_id, q.total AS doc_total, SUM(qi.total) AS items_total
FROM rtb.quotes q JOIN rtb.quote_items qi USING (quote_id)
GROUP BY q.quote_id, q.total
HAVING ABS(q.total - SUM(qi.total) - q.shipping_amount + q.discount_amount) > 0.01;

-- 6. Cotizaciones con clientes inexistentes
SELECT q.* FROM rtb.quotes q
LEFT JOIN rtb.customers c USING (customer_id)
WHERE c.customer_id IS NULL;

-- 7. Productos sin precio vigente
SELECT p.product_id, p.sku FROM rtb.products p
LEFT JOIN rtb.product_prices pp ON pp.product_id = p.product_id AND pp.is_current
WHERE p.is_active AND pp.price_id IS NULL;

-- 8. RFC duplicado entre clientes (sospechoso)
SELECT rfc, COUNT(*) FROM rtb.customer_tax_data GROUP BY rfc HAVING COUNT(*) > 1;
```

---

## Plan de cutover (día C)

| Hora | Acción | Responsable |
|---|---|---|
| Viernes 17:00 | Freeze cambios en Notion (anuncio formal) | PM |
| Viernes 18:00 | Última corrida ETL delta (cambios de la semana) | DBA |
| Viernes 19:00 | Validaciones (queries arriba) | DBA |
| Viernes 20:00 | Verificación operativa: 2 vendedores hacen 1 cotización end-to-end en PG | Ventas |
| Viernes 22:00 | Switch DNS / configuración apuntando a PG | DevOps |
| Sábado 09:00 | Smoke tests por equipo (ventas, compras, almacén, contabilidad) | Todos |
| Sábado 10:00 | Go / No-go decision | PM + Sponsor |
| Lunes 09:00 | Operación normal en PG; Notion read-only | Todos |

---

## Plan de rollback

Si en el smoke test del sábado se detectan problemas críticos:

1. Apagar acceso a PG.
2. Reactivar escritura en Notion (descongelar).
3. Comunicar a equipo: "Lunes seguimos en Notion."
4. Post-mortem el lunes; replanear cutover en 1-2 semanas.

PG mantiene los datos cargados; el rollback es solo operacional, no destructivo.

---

## Cronograma estimado

| Fase | Duración | Esfuerzo total |
|---|---|---|
| Preparación (PG, schema, ETL) | 2 semanas | ~80 hrs |
| Carga inicial + validación | 1 semana | ~40 hrs |
| Paralelización + entrenamiento | 2 semanas | ~30 hrs |
| Cutover | 1 fin de semana | ~16 hrs |
| Estabilización post | 2 semanas | ~20 hrs (en demanda) |
| **Total** | **~7 semanas** | **~186 hrs** |

Con 1 ingeniero senior + 1 ingeniero de datos + 1 PM, asumiendo apoyo del equipo de operaciones para validar.
