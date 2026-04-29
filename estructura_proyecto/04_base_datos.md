# Base de Datos — PostgreSQL + SQLAlchemy

**Propósito:** Definir la estructura de la base de datos, el modelo relacional, migraciones, backups y conexiones.

---

## 1. Motor y Configuración

- **Motor:** PostgreSQL 16.
- **ORM:** SQLAlchemy 2.x (declarativo).
- **Migraciones:** Alembic (versionadas en `backend/alembic/versions/`).
- **Conexión:** pool asíncrono con `asyncpg` (opcional) o `psycopg` sync según el servicio.
- **Credenciales:** en `.env` (`DATABASE_URL`).

---

## 2. Convenciones

- Nombres de tablas en **snake_case plural** (ej. `ventas`, `productos`).
- Llaves primarias: `id BIGSERIAL` o UUID según criterio.
- Llaves foráneas: `{tabla_singular}_id`.
- Timestamps: `created_at`, `updated_at` (UTC).
- Estados como `ENUM` de PostgreSQL cuando el set es cerrado.
- Índices explícitos en columnas de búsqueda frecuente (cliente_id, producto_id, fecha).

---

## 3. Tablas Principales (mapeo a contexto de negocio)

### 3.1 Ventas y Cotizaciones
- `clientes` — id, nombre, rfc, tipo (Local/Foráneo), CP, creado.
- `productos` — id, sku, nombre, categoría, precio_venta, costo_compra, stock_minimo, clasificacion_abc.
- `cotizaciones` — id, cliente_id, fecha_creacion, fecha_aprobacion, fecha_cancelacion, estado, motivo_cancelacion, subtotal, subtotal_po, iva, total, descuento.
- `cotizacion_items` — id, cotizacion_id, producto_id, cantidad_solicitada, cantidad_empacada, precio_unitario, costo_unitario.
- `ventas` — id, cotizacion_id, fecha_venta, subtotal, margen_bruto, estado.
- `pagos` — id, cotizacion_id, fecha_pago, monto, tipo_pago.

### 3.2 Almacén
- `inventario` — id, producto_id, cantidad_real, cantidad_teorica, monto, tipo (Activo/Sin Movimiento/Obsoleto), actualizado_en.
- `movimientos_inventario` — id, producto_id, tipo_movimiento, cantidad_entrante, cantidad_salida, fecha_entrada, fecha_salida, origen, destino.
- `no_conformes` — id, producto_id, cantidad, motivo, accion_tomada, ajuste_inventario, fecha_deteccion, fecha_resolucion.
- `solicitudes_material` — id, producto_id, proveedor_id, cantidad_solicitada, costo_unitario, estado, fecha_solicitud.
- `entradas_mercancia` — id, solicitud_id, producto_id, proveedor_id, cantidad_solicitada, cantidad_llegada, costo_unitario, estado, status_pago, tipo_pago, fecha_esperada, fecha_real.
- `pedidos_incompletos` — id, pedido_id, producto_id, motivo_incompletitud, antigüedad.

### 3.3 Proveedores
- `proveedores` — id, nombre, rfc, categoria, eficiencia_promedio.
- `pedidos_proveedor` — id, proveedor_id, estado, fecha_generacion, fecha_envio, fecha_recoleccion, fecha_recepcion, subtotal.
- `facturas_compras` — id, pedido_id, proveedor_id, fecha_factura, fecha_pago, subtotal, costo_envio, descuento, iva, total, estado, tipo_pago, status_pago.

### 3.4 Ventas Operativo y Logística (migraciones 0015-0016, 2026-04-28)

Ciclo: **NR → Cotización → Pedido → Empacado → Envío/Ruta → CFDI → Cobro**

- `carriers` — Catálogo de fleteras (`is_internal`, `tracking_url_template`).
- `delivery_notes` / `delivery_note_items` — Notas de remisión informales previas a cotización.
- `quote_delivery_notes` — Asociación M:N entre NRs y cotizaciones formales.
- `quotes` / `quote_items` / `quote_status_history` — Cotizaciones formales aprobables. `approved_by`/`rejected_by` FK a `users.id` (UUID).
- `orders` / `order_items` / `order_milestones` — Pedidos creados automáticamente al aprobar cotización (trigger `fn_create_order_from_quote`). `order_items` rastrea `quantity_ordered`, `quantity_packed`, `quantity_shipped`.
- `cfdi` / `cfdi_items` / `cfdi_credit_notes` / `cfdi_payments` — Comprobantes CFDI 4.0. `cfdi` es auto-referenciante para cancelaciones con sustituto.
- `payments` / `payment_applications` — Cobros y su aplicación a pedidos/CFDIs.
- `shipments` / `shipment_items` / `shipment_tracking_events` — Envíos físicos con rastreo por evento.
- `routes` / `route_stops` — Rutas de reparto diarias; paradas tipo `DELIVERY` o `PICKUP`.

**Vistas:** `v_order_packing_progress`, `v_order_payment_status`, `v_orders_incomplete_tracking`, `v_shipments_overview`, `v_cfdi_cancellations`.

**Triggers de negocio:**
- `trg_create_order_from_quote` — Crea pedido al aprobar cotización.
- `trg_sync_shipped_qty` — Sincroniza `order_items.quantity_shipped` desde `shipment_items`.
- `trg_shipment_delivered` — Al entregar: actualiza `orders.delivery_date` + milestone.
- `trg_packing_inv_movement` — Al empacar: genera movimiento `ISSUE` en `movimientos_inventario`.

**Nota de modelos Python:** Las clases se llaman `SalesQuote`/`SalesQuoteItem` (no `Quote`/`QuoteItem`) para evitar colisión con `ops_models.Quote` que mapea a la tabla legacy `cotizaciones`.

### 3.5 Gastos
- `gastos_operativos` — id, fecha, categoria, proveedor_id, concepto, monto, estado, metodo_pago, deducible (bool).

### 3.5 Administración (Workflow)
- `verificador_fechas_pedidos` — id, pedido_id, tipo_etapa, fecha, persona_activo_automatizacion.

### 3.6 Sistema / Auth
- `users` — id, email, password_hash, rol (admin/operativo/lectura), activo, creado.
- `refresh_tokens` — id, user_id, token, expira_en.
- `reportes` — id, user_id, area, formato, secciones, ruta_archivo, fecha_generacion.
- `envios_reporte` — id, reporte_id, destinatarios, asunto, fecha_envio, status.
- `automation_runs` — id, flujo, estado (ok/err/running), iniciado_en, completado_en, error_msg, filas_procesadas.
- `tunnel_status` — id, estado, verificado_en, mensaje.
- `alertas` — id, tipo, severidad, mensaje, leida, creado.

---

## 4. Estructura de Directorios

```
database/
├── config.py                        # URL, engine, sessionmaker
├── init/
│   └── 01_schema.sql                # Esquema bootstrap (opcional)
├── seeds/
│   ├── seed_productos.sql
│   ├── seed_clientes.sql
│   └── seed_proveedores.sql
└── backups/
    └── .gitkeep
```

En el backend:

```
backend/alembic/
├── env.py
├── script.py.mako
└── versions/
    ├── 20260418_000001_initial.py
    ├── 20260425_000002_add_admin_tables.py
    └── ...
```

---

## 5. Estrategia de Migraciones

1. Cada cambio de esquema se crea como migración Alembic:
   ```
   alembic revision -m "descripcion" --autogenerate
   alembic upgrade head
   ```
2. Migraciones se versionan en git.
3. En despliegue, el `entrypoint` del contenedor backend ejecuta `alembic upgrade head` antes de arrancar uvicorn.
4. Los rollbacks se evitan en producción — mejor emitir una migración correctiva hacia adelante.

---

## 6. Indexación Sugerida

- `ventas(cotizacion_id)` — búsqueda por cotización.
- `ventas(fecha_venta)` — rango de fechas.
- `cotizaciones(cliente_id, estado)` — filtros combinados.
- `inventario(producto_id)` — único activo vigente.
- `movimientos_inventario(fecha_entrada DESC)` — últimos movimientos.
- `facturas_compras(proveedor_id, fecha_factura)`.
- `gastos_operativos(fecha, categoria)`.
- `verificador_fechas_pedidos(pedido_id, tipo_etapa)`.

---

## 7. Backups

### Automáticos
- Script `scripts/backup-db.sh` ejecuta `pg_dump` programado vía cron o systemd timer.
- Formato: `backups/nexus_ops_{YYYYMMDD_HHMM}.sql.gz`.
- Retención: 7 diarios + 4 semanales + 6 mensuales (rotación).
- Destino: volumen local + opcional S3/Drive.

### Restauración
- `scripts/restore-db.sh {ruta_backup}`.

---

## 8. Alternativa sin ORM (consultas directas)

Si en algún servicio es preferible SQL crudo para rendimiento (ej. agregaciones grandes), usar `SQLAlchemy Core` con consultas parametrizadas. Evitar concatenación de strings.

---

## 9. Relación con los CSV

- Los CSV refrescados por n8n actúan como **vista materializada** para cargas analíticas.
- La DB es la fuente de verdad transaccional; los CSV son la foto para el dashboard.
- Algunos endpoints leen CSV (rapidez), otros leen DB (consistencia fina).
- Regla: **escritura siempre en DB**, lectura puede ser de CSV si el refresh es reciente.

---

## 9.1 Estado actual (implementado)

Se implementó un esquema inicial pensado para que los CSV se carguen manualmente e incrementalmente sin bloquear la evolución futura del modelo.

### Tablas operativas (public)

- Ventas y clientes
  - `clientes` (catálogo de clientes con `external_id` opcional)
  - `cotizaciones`, `cotizacion_items`, `cotizaciones_canceladas`
  - `ventas`
  - `pedidos_clientes`, `pedidos_incompletos`, `verificador_fechas_pedidos`
- Inventarios
  - `productos`
  - `inventario`, `movimientos_inventario`, `crecimiento_inventario`, `no_conformes`
  - `solicitudes_material`, `entradas_mercancia`
- Proveedores y finanzas
  - `proveedores`, `pedidos_proveedor`, `facturas_compras`, `gastos_operativos`
- Auditoría mínima de carga
  - `csv_import_runs` (metadatos por corrida de importación)

### Staging (schema `staging`)

- `staging.csv_files` — metadatos por archivo cargado (dataset, nombre, hash, header, row_count).
- `staging.csv_rows` — filas crudas como JSON (row_number + payload).
- `staging.csv_row_errors` — errores de parseo/validación por fila.

### Mapeo inicial CSV → tablas

- `Catalogo_de_Productos.csv` → `productos`
- `Reporte_de_Ventas.csv` → `ventas`
- `Cotizaciones_a_Clientes.csv` → `cotizaciones`
- `Detalle_de_Cotizaciones.csv` → `cotizacion_items`
- `Cotizaciones_Canceladas.csv` → `cotizaciones_canceladas`
- `Pedidos_de_Clientes.csv` → `pedidos_clientes`
- `Verificador_de_Fechas_Pedidos.csv` → `verificador_fechas_pedidos`
- `Gestion_de_Inventario.csv` → `inventario` (campos calculados + `raw_payload`)
- `Crecimiento_de_Inventario.csv` → `crecimiento_inventario`
- `No_Conformes.csv` → `no_conformes`
- `Solicitudes_de_Material.csv` → `solicitudes_material`
- `Entradas_de_Mercancia.csv` → `entradas_mercancia`
- `Solicitudes_A_Proveedores.csv` → `pedidos_proveedor`
- `Facturas_Compras.csv` → `facturas_compras`
- `Gastos_Operativos_RTB.csv` → `gastos_operativos`
- `Directorio_Clientes_Proveedores.csv` → `clientes` y `proveedores` (según tipo)
- `Bitacora_de_Movimientos.csv` → `movimientos_inventario`
- `Pedidos_Incompletos.csv` → `pedidos_incompletos`

---

## 10. Diagramas de Relación (abreviado)

```
clientes 1─┐
           ├─< cotizaciones >─┬── cotizacion_items >── productos
           │                  └── ventas >── pagos
proveedores 1─┬─< pedidos_proveedor >─< facturas_compras
              ├─< solicitudes_material >─< entradas_mercancia
              └─< gastos_operativos
productos 1─┬─< inventario
            ├─< movimientos_inventario
            └─< no_conformes
pedido 1─< verificador_fechas_pedidos
users 1─< reportes >─< envios_reporte
```
