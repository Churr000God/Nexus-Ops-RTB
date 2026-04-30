# Modelo nuevo — RTB en PostgreSQL

## Principios de diseño

1. **Una fuente de verdad por dato.** No tablas espejo. Si "Reporte de Ventas" se necesita, es una vista materializada.
2. **Estados como columnas, no como tablas.** Cotización cancelada = `quotes.status = 'CANCELLED'`.
3. **La bitácora es el inventario.** Stock se calcula a partir de `inventory_movements`. Lo demás es vista.
4. **Inmutabilidad del histórico.** Un movimiento, una factura, una orden, no se sobrescriben — se versionan o se anulan con contramovimientos.
5. **Separación clientes/proveedores.** Comparten contactos y direcciones, no comparten tabla.
6. **CFDI 4.0 desde el inicio.** Régimen fiscal, claves SAT, complementos de pago.
7. **Multi-moneda preparado** aunque hoy uses solo MXN.

---

## Bloques funcionales

```
┌─────────────────────────────────────────────────────────────┐
│                    SEGURIDAD Y AUDITORÍA                    │
│   users · roles · permissions · user_roles · audit_log      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                       CATÁLOGOS                             │
│   brands · categories · units · sat_keys                    │
│   products · product_attributes · product_attribute_values  │
│   product_configurations · bom · bom_items                  │
└─────────────────────────────────────────────────────────────┘
┌──────────────────────────┐  ┌──────────────────────────────┐
│        CLIENTES          │  │        PROVEEDORES           │
│ customers                │  │ suppliers                    │
│ customer_addresses       │  │ supplier_addresses           │
│ customer_tax_data        │  │ supplier_tax_data            │
│ customer_contacts        │  │ supplier_contacts            │
│                          │  │ supplier_products (precio)   │
└──────────────────────────┘  └──────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                          VENTAS                             │
│   quotes · quote_items · quote_status_history               │
│   orders · order_items · order_milestones                   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                         COMPRAS                             │
│   purchase_requests · purchase_request_items                │
│   purchase_orders · purchase_order_items                    │
│   supplier_invoices · supplier_invoice_items                │
│   goods_receipts · goods_receipt_items                      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                        INVENTARIO                           │
│   inventory_movements   ← FUENTE DE VERDAD                  │
│   non_conformities                                          │
│   v_inventory_current   (vista: stock por SKU)              │
│   v_inventory_kpis      (vista: ABC, días sin movimiento)   │
│   inventory_snapshots   (cierres mensuales inmutables)      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                  FACTURACIÓN (CFDI 4.0)                     │
│   cfdi · cfdi_items · cfdi_payments · cfdi_credit_notes     │
│   payments · payment_applications                           │
│   operating_expenses                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Decisiones de diseño explicadas

### Productos configurables (maquinaria industrial)

Manejamos **tres niveles**:

1. **`products`** — el modelo base (ej. "Compresor industrial XS-200")
2. **`product_attributes`** — atributos configurables del modelo (potencia, voltaje, color)
3. **`product_configurations`** — configuración específica que un cliente cotiza/ordena (un SKU "instanciado" con valores concretos)
4. **`bom` y `bom_items`** — para máquinas que se ensamblan de partes, lista de materiales

El SKU del catálogo es el modelo base; las cotizaciones referencian `product_configurations` cuando aplica, o el `product` directo cuando es una refacción simple.

### Cotización → Orden → Factura

Una **cotización** (`quotes`) puede tener estados: `DRAFT, SENT, APPROVED, REJECTED, CANCELLED, EXPIRED`. La aprobación dispara la creación de una `order`. La orden, cuando se factura, dispara un `cfdi`. Cada paso tiene su tabla, conectadas por FK; **nada se duplica**.

Los hitos del fulfillment (envío, entrega, validación, pago) viven en `order_milestones`, una tabla de bitácora que reemplaza al "Verificador de fechas".

### Inventario sin redundancia

`inventory_movements` es la única tabla que se escribe. Tipos: `RECEIPT` (entrada por compra), `ISSUE` (salida por venta), `ADJUSTMENT_IN`, `ADJUSTMENT_OUT` (ajustes por no conformidad o conteo), `RETURN_IN`, `RETURN_OUT` (devoluciones). Cada movimiento referencia su origen (FK polimórfica con `source_type` + `source_id`).

El stock actual es la vista `v_inventory_current` que suma entradas y resta salidas por SKU. Los KPIs (ABC, días sin movimiento, semáforo) son la vista `v_inventory_kpis`. Los reportes históricos usan `inventory_snapshots` (cierres inmutables al final de cada mes).

### CFDI 4.0 nativo

Para emitir factura electrónica al cliente final mexicano:
- `cfdi` — cabecera con UUID, fecha, lugar emisión, régimen fiscal emisor/receptor, uso CFDI, forma de pago, método de pago, moneda, tipo de cambio, totales, sello, certificado
- `cfdi_items` — conceptos con clave producto/servicio SAT, clave unidad SAT, impuestos (IVA, ISR, IEPS) por concepto
- `cfdi_payments` — complemento de pago (PPD)
- `cfdi_credit_notes` — notas de crédito (CFDI tipo E)

### Multi-moneda y precios históricos

`supplier_products` lleva precio + moneda + `valid_from` / `valid_to`. Cambiar el precio de un proveedor no destruye el histórico — se inserta una nueva fila. Lo mismo aplica para los precios de venta del catálogo (`product_prices` con vigencia).

### RBAC simple

`roles` (admin, ventas, compras, almacén, contabilidad), `permissions` (granulares por entidad+acción), `user_roles` y `role_permissions`. Tabla `audit_log` registra cualquier INSERT/UPDATE/DELETE relevante con `user_id`, `entity_type`, `entity_id`, `action`, `before_data`, `after_data`, `changed_at`.

---

## Mapeo Notion → PostgreSQL

| Notion (hoy) | PostgreSQL (nuevo) | Notas |
|---|---|---|
| Catálogo de Productos | `products` | + `product_attributes`, `product_configurations` |
| Directorio de Ubicaciones (Tipo=Cliente) | `customers` + `customer_tax_data` + `customer_addresses` | Separamos |
| Directorio de Ubicaciones (Tipo=Proveedor) | `suppliers` + `supplier_tax_data` + `supplier_addresses` | Separamos |
| Proveedores y Productos | `supplier_products` | + histórico de precios |
| Cotizaciones a Clientes | `quotes` | con `status` |
| Detalles de Cotizaciones | `quote_items` | |
| Reporte de Ventas | **vista** `v_sales_report` | derivada de quotes+orders+cfdi |
| Cotizaciones Canceladas | **`quotes` con status=CANCELLED** | tabla eliminada |
| Pedidos de Clientes | `orders` | |
| Pedidos Incompletos | **vista** `v_orders_with_shortage` | tabla eliminada |
| Solicitudes de Material | `purchase_request_items` (cabecera en `purchase_requests`) | |
| Solicitudes A Proveedores (OC) | `purchase_orders` + `purchase_order_items` | |
| FACTURAS COMPRAS | `supplier_invoices` + `supplier_invoice_items` | |
| Entradas de Mercancía | `goods_receipts` + `goods_receipt_items` | dispara `inventory_movements` |
| Gestión de Inventario | **vista** `v_inventory_current` + `v_inventory_kpis` | derivada de movimientos |
| No Conformes | `non_conformities` | dispara `inventory_movements` con tipo ADJUSTMENT |
| Bitácora de Movimientos | `inventory_movements` | **fuente de verdad** |
| Gastos Operativos RTB | `operating_expenses` | |
| Verificador de fechas | `order_milestones` | |
| Crecimiento de Inventario | `inventory_snapshots` | cierres mensuales |

---

## Lo que entregamos en la siguiente fase

- `03_schema.sql` — DDL completo (PostgreSQL 14+) con CREATE TABLE, índices, FKs, CHECKS, comentarios
- `04_views_and_triggers.sql` — vistas `v_inventory_current`, `v_sales_report`, etc., y triggers para sincronizar movimientos
- `05_diagrama_er.svg` — diagrama visual
- `06_logica_de_negocio.docx` — flujos cotización→orden→CFDI, devoluciones, no conformes
- `07_plan_migracion.md` — mapeo Notion→PG, scripts ETL, orden, validaciones
