# Lógica de negocio y contexto del sistema RTB
## Documentación funcional, relaciones entre tablas, cálculos y mapeo de normalización (Notion → n8n)

_Generado el 25 de abril de 2026_

---

## 1. Resumen ejecutivo

El sistema RTB es un conjunto de bases de datos relacionadas en Notion que cubre el **ciclo completo de operación**: ventas (cotizaciones, pedidos y reportes), compras (solicitudes, OCs, entradas, facturas, gastos), inventario (stock, bitácora, no conformes) y soporte/auditoría (verificador de fechas, crecimiento histórico).

Sobre estas bases corre un **flujo de n8n** que extrae cada base con un nodo Notion ("Get many database pages") filtrado por última edición del día y la pasa por un nodo Set ("Normalizador") que aplana la estructura cruda de propiedades de Notion a un esquema plano con tipos definidos (string, number, boolean, array).

**El objetivo de la normalización es triple:**
- (a) Descomponer las propiedades anidadas de Notion (rollups, fórmulas, relaciones) en campos planos.
- (b) Tipar correctamente los valores para downstream.
- (c) Renombrar las propiedades a etiquetas humanas estables que no dependen de los slugs internos de Notion.

### 1.1. Bloques funcionales

| Bloque | Descripción |
|--------|-------------|
| **Catálogos maestros** | Fuente de verdad para SKU, código interno, clientes, proveedores y precios proveedor-producto |
| **Flujo de Ventas** | Cotización → Detalles → Pedido → Reporte de ventas, con desvíos a canceladas e incompletos |
| **Flujo de Compras** | Solicitudes de material → OC a proveedor → Factura compra → Entrada de mercancía + gastos operativos |
| **Inventario y Calidad** | Gestión de stock, bitácora de movimientos y no conformes (ajustes) |
| **Soporte / Auditoría** | Verificador de fechas (hitos de pedido) y crecimiento de inventario (KPI histórico) |

---

## 2. Cómo funciona el sistema

### 2.1. Catálogos maestros

- **Catálogo de Productos** es el maestro de SKU y Código Interno; casi todas las bases lo referencian.
- **Directorio de Ubicaciones** es el maestro de clientes y proveedores en una sola tabla discriminada por el campo `Tipo`; su `Siglas/ID` es la llave que comparten ventas, compras y gastos.
- **Proveedores y Productos** es la tabla puente que asocia un producto con uno o varios proveedores y guarda el `Precio (MXN)` por proveedor.

### 2.2. Flujo de Ventas

```
Cotización a Cliente (apunta a cliente del Directorio)
    └── N Detalles de Cotización (por SKU del Catálogo)
            ├── Aprobada → Pedido de Cliente
            │       ├── Reporte de Ventas
            │       └── Verificador de fechas
            ├── Con faltantes → Pedidos Incompletos
            └── Cancelada → Cotizaciones Canceladas
```

### 2.3. Flujo de Compras

```
Solicitudes de Material (renglones por SKU)
    └── Agrupadas en Solicitud A Proveedor (OC con Folio)
            └── Al recibir mercancía → Entrada de Mercancía
                    ├── Ligada a FACTURAS COMPRAS
                    └── Ligada a Código Interno en Gestión de Inventario

Gastos Operativos RTB (gastos no inventariables, ligados al Directorio)
```

### 2.4. Inventario y Calidad

- **Gestión de Inventario**: stock teórico vs real del producto; consolida rollups de entradas, salidas y ajustes.
- **Bitácora de Movimientos**: log único de cada entrada (desde Entradas de Mercancía) y cada salida (desde Detalles de Cotizaciones).
- **No Conformes**: ajusta inventario (entrada/salida según `Tipo de Ajuste`); ligado al producto, al pedido del cliente y a la factura origen.

### 2.5. Soporte

- **Verificador de fechas pedidos**: bitácora transversal de hitos (envío, entrega, aprobación, pago, facturación) ligado a Cliente + Cotización + Pedido.
- **Crecimiento de Inventario**: tabla aislada para histórico/KPI de monto de inventario y productos sin movimiento.

---

## 3. Llaves principales que viajan entre bases

| Llave | Tabla maestra | Aparece en |
|-------|--------------|------------|
| `SKU` / `Código Interno` | Catálogo de Productos | Detalles Cotizaciones, Gestión Inventario, Solicitudes Material, Entradas Mercancía, Bitácora, No Conformes, Proveedores y Productos |
| `Siglas/ID` (cliente / proveedor) | Directorio de Ubicaciones | Cotizaciones, Pedidos, Solicitudes a Proveedor, Facturas Compras, Gastos Operativos, Solicitudes Material, Verificador fechas |
| `# Cotización` | Cotizaciones a Clientes | Detalles, Pedidos, Reporte Ventas, Canceladas, Pedidos Incompletos, Verificador fechas |
| `Folio de Pedido` (OC) | Solicitudes A Proveedores | Solicitudes Material, Facturas Compras |
| `# Factura` / `# Cotización proveedor` | FACTURAS COMPRAS | Entradas Mercancía, Solicitudes A Proveedores, No Conformes |

---

## 4. Cálculos y reglas de negocio

Los cálculos viven en dos lugares: (a) fórmulas y rollups dentro de Notion (que el flujo solo lee), y (b) cálculos derivados que se ejecutan dentro del nodo Set durante la normalización.

### 4.1. Cálculos derivados en la normalización (nodo Set de n8n)

#### Entradas de Mercancía → Costo unitario
```
costo_unitario = cantidad_llegada > 0 ? (costo_total / cantidad_llegada) : 0
```
Notion guarda costo total y cantidades; el costo unitario se reconstruye en el Set para uso analítico. Origen: `property_costo_total` y `property_cantidad_llegada`.

#### Solicitudes A Proveedores → Subtotal
```
subtotal = total - iva - envio
```
Notion solo persiste total + IVA + envío; el subtotal limpio se infiere en el Set. Origen: `property_total`, `property_iva`, `property_envio`.

#### FACTURAS COMPRAS → Costo accesorio consolidado
```
costo_accesorio = (costo_de_envio || 0) + (seguro_de_envio || 0) + (descuento_factura || 0)
```
Se agrupan los tres conceptos accesorios de la factura en un solo campo para análisis de costo total.

### 4.2. Cálculos críticos que viven en Notion (rollups y fórmulas)

| Tabla | Campos calculados en Notion |
|-------|-----------------------------|
| **Cotizaciones a Clientes** | `sub_total_formula`, `subtotal_compra_formula`, `productos_faltantes_f`, `empacado` |
| **Detalles de Cotizaciones** | `costo_unitario_de_compra_formula` (del proveedor); `subtotal`, `subtotal_compra` (cantidad × costo) |
| **Reporte de Ventas** | `costo_compra_formula`, `margen_bruto`, `% margen`, `diferencia vs PO`, `% empacado` → P&L unitario por venta |
| **Gestión de Inventario** | `cantidad_real`, `cantidad_teorica`, `diferencia_stock`, `costo_total_en_stock`, `dias_sin_movimiento`, `semaforo`, `clasificacion_abc`, `accion_sugerida` (consolida `entrada_t_fac`, `entrada_t_pedidos`, `salida_t`, `salida_r`, `ajuste_nc`) |
| **Catálogo de Productos** | Demanda histórica 90/180 días, total venta acumulado, salida teórica/real, costo total en stock (forecast y compras) |
| **Pedidos de Clientes** | `total_formula`, `sub_total_formula`, `% de pedido` (avance de empacado) |

### 4.3. Reglas de tipado durante la normalización

| Caso | Regla aplicada |
|------|---------------|
| Relaciones / rollups | Se toma siempre el primer elemento `[0]`; si hay múltiples, se pierden los adicionales |
| Fechas con `start` (date range) | Se extrae `.start`; el `.end` no se persiste |
| Arrays grandes | Se serializan con `JSON.stringify` y se marcan como tipo `array` |
| Booleans | `checkbox` de Notion se mapea directo |
| Number en campos aparentemente string | Campos como `% empacado` o `Estado Ariba` pueden tener inconsistencia de tipo; revisar downstream |

---

## 5. Mapeo de normalización por tabla

### 5.1. Catálogo de Productos
**Rol:** Maestro de SKU y Código Interno. Fuente de verdad de descripciones, precios y demanda histórica.  
**Llave expuesta:** `SKU` + `Código Interno`

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `property_nombre_del_producto` | Nombre del producto | string |
| `property_sku` | SKU | string |
| `property_descripci_n` | Descripción | string |
| `property_status` | Status | string |
| `property_tipo_de_venta` | Tipo de venta | string |
| `property_tama_o_del_paquete` | Tamaño del paquete | string |
| `property_marca[0]` | Marca | string (rollup) |
| `property_categor_a[0]` | Categoría | string (rollup) |
| `property_precio_unitario` | Precio unitario | number |
| `property_costo_refacciones_f` | Costo refacciones | number (fórmula) |
| `property_costo_ariba_f` | Costo Ariba | number (fórmula) |
| `property_totrealstock` | Total real en stock | number (rollup) |
| `property_totcstock` | Costo total en stock | number (rollup) |
| `property_salida_teorica_final` | Salida teórica | number |
| `property_salida_real_final` | Salida real | number |
| `property_demanda_hist_rica_90_d_as_formula` | Demanda histórica 90 días | number (fórmula) |
| `property_demanda_hist_rica_180_d_as_formula` | Demanda histórica 180 días | number (fórmula) |
| `property_total_venta_acumulado_formula` | Total venta acumulado | number (fórmula) |
| `property_formula_ufs.start` | Fecha última salida | string (fecha) |
| `property_codigo_interno[0]` | Código interno | string (rollup) |

---

### 5.2. Directorio de Ubicaciones (Clientes y Proveedores)
**Rol:** Maestro unificado de clientes y proveedores; el campo `Tipo` discrimina.  
**Llave expuesta:** `Siglas/ID`

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_clientes/Proveedores | string (Notion page id) |
| `property_nombre_del_cliente` | Nombre | string |
| `property_siglas_id` | ID / siglas | string |
| `property_tipo` | Tipo | string (Cliente\|Proveedor) |
| `property_categoria` | Categoría | string |
| `property_estatus` | Estatus | string |
| `property_rfc` | RFC | string |
| `property_contacto_principal` | Contacto principal | string |
| `property_tel_fono` | Teléfono | string |
| `property_email` | Email | string |
| `property_raz_n_social` | Dirección ⚠ | string |
| `property_compra_anual_f` | Compra anual | number (fórmula) |
| `property_ltima_actualizaci_n` | Última compra | string (fecha) |
| `property_tpp` | Tiempo promedio de pago | string |

> ⚠ El mapeo `raz_n_social → Dirección` parece un crossover de nombres; confirmar contra Notion qué propiedad guarda realmente la dirección física.

---

### 5.3. Proveedores y Productos (tabla puente)
**Rol:** Asocia un producto con uno o varios proveedores y guarda el precio en MXN. Habilita comparación de precios por SKU.  
**Llave:** Combinación `SKU producto` + `ID proveedor`

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_proveedor_producto | string |
| `$json.name` | Producto | string (título de página) |
| `property_id_del_producto[0]` | ID producto / SKU | string (rollup) |
| `property_nombre_del_proveedor[0]` | Nombre del proveedor | string (rollup) |
| `property_id_del_proveedor[0]` | ID del proveedor | string (rollup) |
| `property_precio_mxn` | Precio | number |
| `property_tipo_de_proveedor` | Tipo de proveedor | string |
| `property_disponibilidad` | Disponibilidad | boolean |
| `property_fecha_de_actualizaci_n` | Fecha de creación / actualización | string (fecha) |
| `property_solicitudes_de_pedidos_a_proveedores[0]` | Relación con solicitudes de material | string (rollup) |
| `property_entradas_de_mercanc_a[0]` | Relación con entradas de mercancía | string (rollup) |

---

### 5.4. Cotizaciones a Clientes
**Rol:** Cabecera del documento de venta. Origen del flujo de Ventas.  
**Llaves:** `id_Cotizacion`, `Nombre de Cotización` (PO/folio), `ID de cliente`

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_Cotizacion | string |
| `$json.name` | Nombre de Cotización | string |
| `property_estado` | Estado | string |
| `property_estado_del_pedido_auto` | Estado del pedido | string (fórmula) |
| `property_cliente[0]` | Cliente | string (rollup) |
| `property_fecha_de_creaci_n` | Fecha de creación | string |
| `property_fecha_de_aprobaci_n` | Fecha de aprobación | string |
| `property_seguimiento.start` | Fecha de seguimiento | string |
| `property_descuento` | Descuento | string |
| `property_costo_de_envio` | Costo de envío | string |
| `property_credito` | Crédito | boolean |
| `property_meses` | Meses | number |
| `property_total` | Total | number |
| `property_sub_total_formula` | Subtotal | number (fórmula) |
| `property_subtotal_compra_formula` | Subtotal compra | number (fórmula) |
| `property_tiempo_de_aprobacion` | Tiempo de pago | string |
| `property_tipo_de_pago[0]` | Tipo de pago | string (rollup) |
| `property_productos_faltantes_f` | Productos faltantes | string (fórmula) |
| `property_empacado` | % empacado | string |
| `property_ariba_estado` | Estado Ariba | number |
| `property_id_de_c_liente[0]` | ID de cliente | string (rollup) |
| `property_tipo_de_entrega` | Rol/tipo de entrega | string |
| `property_fecha_act.start` | Fecha de empacado | string |

---

### 5.5. Detalles de Cotizaciones a Clientes
**Rol:** Renglones (line items) por SKU de cada cotización. Relación 1 cotización → N detalles.  
**Llaves:** `ID_Partida`, `# de Partida` + Cotización relacionada + SKU

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | ID_Partida | string |
| `property_de_partida` | ID de detalle/partida | string |
| `property_estado` | Estado | string |
| `property_cotizaciones_a_clientes[0]` | Cotización relacionada | string (relación) |
| `property_producto[0]` | Producto | string (relación) |
| `property_sku[0]` | SKU | string (rollup) |
| `property_categoria_de_ganancias[0]` | Categoría | string (rollup) |
| `property_cantidad_solicitada` | Cantidad solicitada | number |
| `property_cantidad_empacada` | Cantidad empacada | number |
| `property_cantidad_faltante` | Cantidad faltante | number |
| `property_costo_unitario_de_compra_formula` | Costo unitario de compra | number (fórmula) |
| `property_costo_unitario_v` | Costo unitario de venta | number |
| `property_subtotal` | Subtotal | number |
| `property_subtotal_compra` | Subtotal compra | number |
| `property_venta_acumulada` | Venta acumulada | number |
| `property_ultimos_90_dias` | Últimos 90 días | number |
| `property_ultimos_180_dias` | Últimos 180 días | number |
| `property_estado_de_cotizacion[0]` | Estado de cotización | string (rollup) |
| `property_cliente[0]` | Cliente | string (rollup) |
| `property_ultima_hora_de_edicion` | Fecha de última edición | string |

---

### 5.6. Reporte de Ventas
**Rol:** Espejo aprobado de cada cotización vendida; soporta P&L unitario.  
**Llave:** `id_Reporte_ventas` + Cotización relacionada

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_Reporte_ventas | string |
| `property_nombre_de_venta` | Nombre de venta | string |
| `property_fecha` | Fecha | string |
| `property_cliente[0]` | Cliente | string (rollup) |
| `property_estado[0]` | Estado | string (rollup) |
| `property_subtotal` | Subtotal | number |
| `property_total` | Total | number |
| `property_costo_compra_formula` | Costo compra | number (fórmula) |
| `property_margen_bruto` | Margen bruto | number (fórmula) |
| `property_margen` | % margen | number (fórmula) |
| `property_diferencia` | Diferencia vs PO | number |
| `property_porcentaje_empacado_formula` | Porcentaje empacado | string (fórmula) |
| `property_a_o_mes` | Año-Mes | string |
| `property_cuatrimestre` | Cuatrimestre | string |
| `property_estado_r` | Estado R | number |
| `property_cotizacion[0]` | Cotización relacionada | string (relación) |

---

### 5.7. Cotizaciones Canceladas
**Rol:** Subset de cotizaciones que terminaron en cancelación, con motivo y fecha.

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_cotizacion_cancelada | string |
| `property_n_mero_de_cotizaci_n` | Número de cotización | string |
| `property_fecha_de_cancelaci_n` | Fecha de cancelación | string |
| `property_motivo_de_cancelaci_n` | Motivo de cancelación | string |
| `property_cotizacion[0]` | Cotización relacionada | string (relación) |
| `property_cliente[0]` | Cliente | string (rollup) |

---

### 5.8. Pedidos de Clientes
**Rol:** Pedido confirmado a partir de cotización aprobada. Hub de fechas de fulfillment.  
**Llaves:** `id_pedido_cliente` + Cotización + ID cliente + PO

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_pedido_cliente | string |
| `property_nombre_del_pedido` | Nombre del pedido | string |
| `property_cliente[0]` | Cliente | string (rollup) |
| `property_id_cliente[0]` | ID cliente | string (rollup) |
| `property_tipo_de_pago` | Tipo de pago | string |
| `property_estado_de_factura` | Estado de factura | string |
| `property_estado_de_pedido` | Estado de pedido | string |
| `property_estatus_de_pago` | Estatus de pago | string |
| `property_fecha_de_pedido` | Fecha de pedido | string |
| `property_fecha_de_validacion` | Fecha de validación | string |
| `property_fecha_de_aprobacion` | Fecha de aprobación | string |
| `property_fecha_de_asociacion` | Fecha de asociación | string |
| `property_fecha_de_envio` | Fecha de envío | string |
| `property_fecha_de_entrega` | Fecha de entrega | string |
| `property_fecha_de_facturacion` | Fecha de facturación | string |
| `property_fecha_de_pago` | Fecha de pago | string |
| `property_responsable_de_surtido[0]` | Responsable de surtido | string (rollup) |
| `property_cotizacion[0]` | Cotización | string (relación) |
| `property_pedidos_incompletos[0]` | Pedidos incompletos | string (relación) |
| `property_no_conformes[0]` | No conformes | string (relación) |
| `property_rol[0]` | Tipo de entrega | string (rollup) |
| `property_total_formula` | Total | number (fórmula) |
| `property_sub_total_formula` | Subtotal con envío | number (fórmula) |
| `property_tiempo_de_entrega` | Tiempo de entrega | number |
| `property_tiempos_de_pago` | Tiempos de pago | string |
| `property_tiempos_de_preparacion` | Tiempos de preparación | number |
| `property_tiene_faltante` | Tiene faltante | boolean |
| `property_de_pedido` | % de pedido / % empacado | string |

---

### 5.9. Pedidos Incompletos
**Rol:** Vista filtrada de Pedidos de Clientes con faltantes; mismo origen de BD, distinto Set.

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_pedido_incompleto | string |
| `$json.name` | Nombre del pedido | string |
| `property_estado[0]` | Estado | string (rollup) |
| `property_estado_de_pedido` | Estado del pedido | string |
| `property_cliente[0]` | Cliente | string (rollup) |
| `property_fecha_de_creaci_n` | Fecha de creación | string |
| `property_fecha_de_pedido` | Fecha de pedido | string |
| `property_fecha_de_aprobacion` | Fecha de aprobación | string |
| `property_fecha_de_validacion` | Fecha de validación | string |
| `property_fecha_de_envio` | Fecha de envío | string |
| `property_fecha_de_entrega` | Fecha de entrega | string |
| `property_fecha_de_facturacion` | Fecha de facturación | string |
| `property_fecha_de_pago` | Fecha de pago | string |
| `property_total_formula` | Total | number (fórmula) |
| `property_sub_total_formula` | Subtotal | number (fórmula) |
| `property_tipo_de_pago` | Tipo de pago | string |
| `property_estatus_de_pago` | Estatus de pago | string |
| `property_rol[0]` | Rol/tipo de entrega | string (rollup) |
| `property_direcci_n_de_entrega[0]` | Dirección de entrega | string (rollup) |
| `property_po[0]` | PO | string (rollup) |
| `property_id_cliente[0]` | ID cliente | string (rollup) |
| `property_tiene_faltante` | Tiene faltante | boolean |
| `property_de_pedido` | % de pedido | string |
| `property_cotizacion[0]` | Cotización relacionada | string (relación) |
| `property_tiempo_de_entrega` | Tiempo de entrega | number |
| `property_notas` | Notas | string |

---

### 5.10. Solicitudes de Material
**Rol:** Renglones de necesidad de compra por SKU; se agrupan en una OC al proveedor.

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_solicitud_material | string |
| `$json.name` | Producto SKU | string |
| `property_producto_nombre[0]` | Producto nombre | string (rollup) |
| `property_cantidad_solicitada` | Cantidad solicitada | number |
| `property_cantidad_solicitada_despues_de_conversion` | Cantidad solicitada después de conversión | number |
| `property_fecha_de_solicitud` | Fecha de solicitud | string |
| `property_estado` | Estado | string |
| `property_proveedor[0]` | Proveedor | string (rollup) |
| `property_costo_unitario_formula` | Costo unitario | number (fórmula) |
| `property_monto_total` | Monto total | number |
| `property_solicitud_en_paquete` | TDP / tamaño del paquete | boolean |
| `property_d_as_sin_movimiento[0]` | Días sin movimiento | string (rollup) |
| `property_bloqueo_por_inventario_dormido[0]` | Bloqueo por inventario dormido | string (rollup) |
| `property_motivo_de_excepci_n_de_compra[0]` | Motivo de excepción de compra | string (rollup) |
| `property_demanda_hist_rica_90_d_as[0]` | Demanda histórica 90/180 días | number (rollup) |
| `property_gestion_producto[0]` | Última salida válida | string (rollup) |

---

### 5.11. Solicitudes A Proveedores (OC)
**Rol:** Orden de compra agregada al proveedor con folio único.  
**Llave:** `Folio de pedido`

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_solicitud_proveedor | string |
| `property_folio_de_pedido` | Folio de pedido | string |
| `property_estado_del_pedido` | Estado del pedido | string |
| `property_estado_de_recoleccion` | Estado de recolección | string |
| `property_fecha_de_generacion.start` | Fecha de generación | string |
| `property_fecha_de_envio.start` | Fecha de envío | string |
| `property_fecha_de_confirmacion.start` | Fecha de confirmación | string |
| `property_fecha_de_estimada_de_recoleccion.start` | Fecha estimada de recolección | string |
| `property_fecha_de_recoleccion` | Fecha de recolección | string |
| `property_proveedor[0]` | Proveedor | string (rollup) |
| `JSON.stringify(property_productos_solicitados)` | Productos solicitados | array (serializado) |
| `total - iva - envio` (calculado) | Subtotal | number (derivado) |
| `property_envio` | Envío | number |
| `property_iva` | IVA | number |
| `property_total` | Total | number |
| `property_confirmado` | Confirmado | boolean |
| `property_enviado_por_correo` | Enviado por correo | boolean |
| `property_impreso` | Impreso | boolean |
| `JSON.stringify(property_responsable_de_seguimiento)` | Responsable de seguimiento | array (serializado) |
| `property_facturas_compras[0]` | Factura compra relacionada | string (relación) |

---

### 5.12. FACTURAS COMPRAS
**Rol:** Documento financiero del proveedor; consolida lo entregado y el pago.  
**Llaves:** `# de cotización` (proveedor) + `# de factura`

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_factura_compra | string |
| `property_de_cotizacion` | # de cotización | string |
| `property_de_factura` | # de factura | string |
| `property_proveedor[0]` | Proveedor | string (rollup) |
| `property_rfc[0]` | RFC | string (rollup) |
| `property_fecha_de_recepci_n` | Fecha de recepción | string |
| `property_fecha_de_factura.start` | Fecha de factura | string |
| `property_fecha_de_pago` | Fecha de pago | string |
| `envio + seguro + descuento` (calculado) | Costo de envío / seguro / descuento | number (derivado) |
| `property_tipo_de_compra` | Tipo de compra | string |
| `property_tipo_de_pago[0]` | Tipo de pago | string (rollup) |
| `property_status_del_pedido` | Status del pedido | string |
| `property_status_de_pago` | Status de pago | string |
| `property_estatus_de_factura` | Estatus de factura | string |
| `property_subtotal_f` | SUBTOTAL | number (fórmula) |
| `property_iva_16` | IVA 16% | number |
| `property_total` | TOTAL | number |
| `property_porcentaje_e` | Porcentaje de entregado | number (fórmula) |
| `JSON.stringify(property_entradas_de_mercanc_a)` | Entradas de mercancía relacionadas | array (serializado) |
| `JSON.stringify(property_no_conformes)` | No conformes relacionadas | array (serializado) |
| `JSON.stringify(property_solicitudes_a_proveedores)` | Solicitudes a proveedores relacionadas | array (serializado) |
| `property_responsable_de_revision_de_material[0]` | Responsable de revisión de material | string (rollup) |

---

### 5.13. Entradas de Mercancía
**Rol:** Recepción física del material; alimenta inventario y dispara la bitácora de entrada.  
**Llave:** `Número de entrada` + Factura relacionada

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_entrada_mercancia | string |
| `property_n_mero_de_entrada` | Número de entrada | string |
| `property_cantidades_solicitada` | Cantidad solicitada | number |
| `property_cantidad_llegada` | Cantidad llegada | number |
| `property_proveedor[0]` | Proveedor | string (rollup) |
| `property_codigo_interno[0]` | Código interno | string (rollup) |
| `property_producto[0]` | Producto | string (relación) |
| `costo_total / cantidad_llegada` (calculado) | Costo unitario | number (derivado) |
| `property_costo_total` | Costo total | number |
| `property_fecha_de_creaci_n` | Fecha de creación / recepción | string |
| `property_porcentaje_de_entrega` | Porcentaje de entrega | number |
| `property_validaci_n_f_sica` | Validación física | boolean |
| `property_fecha_de_pago[0]` | Fecha de pago | string (rollup) |
| `property_status_de_pago[0]` | Status de pago | string (rollup) |
| `property_tipo_de_pago[0]` | Tipo de pago | string (rollup) |
| `property_factura[0]` | Factura relacionada | string (relación) |
| `property_tama_o_del_paquete` | TDP | number |
| `property_cantidad_solicitada_despues_de_conversion` | Cantidad solicitada después de conversión | number |
| `property_validado_por[0]` | Validado por | string (rollup) |

---

### 5.14. Gestión de Inventario
**Rol:** Vista consolidada de stock por SKU/Código Interno: teórico vs real, ajustes, KPIs ABC.

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | Gestion_inventario_id | string |
| `property_codigo_interno` | Código interno | string |
| `property_sku` | SKU | string |
| `property_nombre_de_producto` | Nombre de producto | string |
| `property_categoria` | Categoría | string |
| `property_proveedor` | Proveedor | string |
| `property_stock_minimo` | Stock mínimo | number |
| `property_entradas_r` | Entradas R | number |
| `property_entrada_t_fac` | Entrada T Fac | number (rollup) |
| `property_entrada_t_pedidos` | Entrada T Pedidos | number (rollup) |
| `property_ajuste_nc` | Ajuste NC | number (rollup) |
| `property_salida_r` | Salida R | number |
| `property_salida_t` | Salida T | number (rollup) |
| `property_cantidad_real_en_inventario` | Cantidad real en inventario | number (fórmula) |
| `property_cantidad_teorica_en_inventario` | Cantidad teórica en inventario | number (fórmula) |
| `property_diferencia_stock` | Diferencia stock | number (fórmula) |
| `property_costo_unitario` | Costo unitario | number |
| `property_costo_total_en_stock` | Costo total en stock | number (fórmula) |
| `property_estado_real` | Estado real | string |
| `property_alerta_de_stock` | Alerta de stock | string |
| `property_bloqueo_de_compra` | Bloqueo de compra | string |
| `property_dias_sin_movimiento` | Días sin movimiento | number |
| `property_semaforo_de_movimiento` | Semáforo de movimiento | string |
| `property_clasificacion_de_antiguedad` | Clasificación de antigüedad | string |
| `property_clasificacion_de_rotacion` | Clasificación de rotación | string |
| `property_clasificacion_abc_auto` | Clasificación ABC auto | string |
| `property_accion_sugerida` | Acción sugerida | string |
| `property_ultima_entrada` | Última entrada | string |
| `property_ultima_salida` | Última salida | string |
| `property_demanda_historica_90_180_dias` | Demanda histórica 90/180 días | string |
| `property_total_venta_acumulada` | Total venta acumulada | number |
| `property_producto_interno` | Producto interno | string |
| `property_procesado` | Procesado | boolean |
| `property_revisado` | Revisado | boolean |
| `property_diferencia_fisica` | Diferencia física | number |

---

### 5.15. No Conformes
**Rol:** Ajuste de calidad sobre inventario (entrada o salida según el `Tipo de Ajuste`).

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_no_conforme | string |
| `property_folio` | Folio | string |
| `property_fecha.start` | Fecha | string |
| `property_cantidad` | Cantidad | number |
| `property_motivo` | Motivo | string |
| `property_acci_n_tomada` | Acción tomada | string |
| `property_tipo_de_ajuste` | Tipo de ajuste | string |
| `property_estado` | Estado | string |
| `property_producto[0]` | Producto | string (relación) |
| `property_gesti_n_de_inventario[0]` | Gestión de inventario relacionada | string (relación) |
| `property_facturas_compras[0]` | Factura compra relacionada | string (relación) |
| `property_pedidos_de_clientes[0]` | Pedido de cliente relacionado | string (relación) |
| `property_responsable_que_detect[0]` | Responsable que detectó | string (rollup) |
| `property_ajuste_inventario` | Ajuste inventario | number |
| `property_observaciones` | Observaciones | string |
| `property_ubicaci_n_f_sica_temporal` | Ubicación física temporal | string |

---

### 5.16. Bitácora de Movimientos
**Rol:** Log único de cada movimiento de stock (entradas, salidas, no conformidades).

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_movimiento | string |
| `property_movimiento` | ID / movimiento | string |
| `property_tipo_de_movimiento` | Tipo de movimiento | string |
| `property_producto[0]` | Producto | string (relación) |
| `property_cantidad_entrante` | Cantidad entrante | number |
| `property_cantidad_salida` | Cantidad salida | number |
| `property_cantidad_por_no_conformidad` | Cantidad por no conformidad | number |
| `property_referencia_entrada[0]` | Referencia entrada | string (relación) |
| `property_referencia_salida[0]` | Referencia salida | string (relación) |
| `property_responsable_entrada[0]` | Responsable entrada | string (rollup) |
| `property_responsable_salida[0]` | Responsable salida | string (rollup) |
| `property_c_digo_interno[0]` | Código interno | string (rollup) |
| `property_fecha_y_hora` | Fecha y hora | string |

---

### 5.17. Gastos Operativos RTB
**Rol:** Gastos no inventariables (servicios, viáticos, fijos), ligados al Directorio.

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_gasto_operativo | string |
| `$json.name` | Concepto / descripción | string |
| `property_folio_factura` | Folio / factura | string |
| `property_subtotal` | Subtotal | number |
| `property_iva` | IVA | number |
| `property_total` | Total | number |
| `property_fecha.start` | Fecha | string |
| `property_deducible` | ¿Deducible? | boolean |
| `property_categor_a` | Categoría | string |
| `property_m_todo_de_pago` | Método de pago | string |
| `property_estado` | Estado | string |
| `property_responsable[0]` | Responsable | string (rollup) |
| `property_establecimiento_proveedor[0]` | Proveedor | string (relación) |
| `property_rfc_proveedor` | RFC proveedor | string |

---

### 5.18. Verificador de fechas pedidos
**Rol:** Bitácora transversal de hitos por pedido (envío, entrega, aprobación, pago, facturación).

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_verificador_fechas | string |
| `property_pedido` | Pedido | string |
| `property_tipo` | Tipo | string (hito) |
| `property_fecha.start` | Fecha | string |
| `property_hora.start` | Hora | string |
| `property_persona_que_activo_la_automatizacion[0]` | Persona que activó la automatización | string (rollup) |
| `property_cliente[0]` | Cliente | string (rollup) |
| `property_cotizaci_n[0]` | Cotización | string (rollup) |
| `property_pedido_link[0]` | Pedido link | string (rollup) |

---

### 5.19. Crecimiento de Inventario
**Rol:** Histórico de monto de inventario para reportes y KPIs; tabla aislada del flujo operativo.

| Campo Notion (origen) | Campo normalizado | Tipo |
|----------------------|-------------------|------|
| `$json.id` | id_crecimiento_inventario | string |
| `property_nombre` | Nombre | string |
| `property_fecha_de_registro.start` | Fecha de registro | string |
| `property_monto` | Monto | number |
| `property_tipo` | Tipo de crecimiento de inventario | string |

---

## 6. Flujo extremo a extremo (caso de ejemplo)

```
1.  Cliente envía PO
        → Cotización a Cliente (Nombre = PO, Cliente → Directorio)

2.  Creación de líneas por SKU
        → N Detalles de Cotización
          (SKU ← Catálogo, Costo unitario compra ← Proveedores y Productos)

3.  Productos sin stock → Solicitudes de Material (por SKU)
        → Agrupadas en Solicitud A Proveedor (Folio de OC)

4.  Proveedor envía factura
        → FACTURAS COMPRAS (# cotización proveedor + # factura, ligada a OC)

5.  Llega la mercancía
        → Entrada de Mercancía (# Entrada, ligada a Factura)
        → Bitácora de Movimientos: fila de tipo ENTRADA

6.  Gestión de Inventario actualiza
        → suma entrada_t_fac
        → recalcula cantidad_real, cantidad_teorica
        → actualiza Semáforo, Clasificación ABC, Días sin movimiento

7.  Cotización aprobada
        → Pedido de Cliente (Cotización como llave)
        → Verificador de fechas: hitos de envío, entrega, pago, facturación

8.  Empacado y venta
        → Detalles reducen inventario (salida_t)
        → Bitácora de Movimientos: fila de tipo SALIDA

9.  Defecto detectado (opcional)
        → No Conforme (Producto + Factura compra, Tipo de Ajuste decide dirección)

10. Cierre de la venta
        → Reporte de Ventas (espejo de cotización con margen, costo compra, % empacado)
```

---

## 7. Notas y oportunidades de mejora

| # | Área | Descripción | Acción sugerida |
|---|------|-------------|-----------------|
| 1 | Directorio de Ubicaciones | Mapeo `raz_n_social → Dirección` parece un crossover de nombres; el slug posiblemente corresponde a Razón Social, no a dirección física | Confirmar contra Notion y corregir el campo normalizado |
| 2 | Cotizaciones / Pedidos | `Estado Ariba` y `% empacado` están tipados de forma inconsistente (string vs number) | Homologar para evitar fallos en pipelines downstream |
| 3 | Rollups con múltiples valores | Se toma solo `[0]`; si una cotización vincula varios clientes (raro pero posible), se pierden | Evaluar `JSON.stringify` para rollups críticos multi-valor |
| 4 | División por cero | Entradas de Mercancía ya protege con guardia `cantidad > 0`; otras divisiones en Notion deben tener la misma cautela | Auditar fórmulas de costo unitario en otras tablas |
| 5 | Filtro por `last_edited_time` del día | Correcciones retroactivas o cierres nocturnos con fecha lógica anterior no entran al pipeline | Agendar un sweep semanal con filtro por fecha lógica para auditoría |
| 6 | Pedidos Incompletos duplica lectura | Los nodos de Pedidos de Clientes y Pedidos Incompletos apuntan al mismo `databaseId`; todo se procesa dos veces | Agregar filtro `tiene_faltante = true` en la consulta de Pedidos Incompletos |
