# Catálogo Unificado de Bases de Datos — Nexus Ops RTB

**Propósito:** Listado consolidado de todas las bases de datos referenciadas a través de las cuatro áreas (Ventas, Almacén, Finanzas, Administración), indicando qué métricas se alimentan de cada una y en qué áreas se utilizan.

---

## Bases de Datos por Área

| # | Base de Datos | Áreas que la consumen |
|---|---|---|
| 1 | Reporte de Ventas | Ventas, Finanzas |
| 2 | Cotizaciones a Clientes | Ventas, Finanzas, Administración |
| 3 | Cotizaciones Canceladas | Ventas, Finanzas |
| 4 | Pedidos de Clientes | Ventas, Administración |
| 5 | Crecimiento de Inventario | Almacén |
| 6 | No Conformes | Almacén |
| 7 | Gestión de Inventario | Almacén |
| 8 | Bitácora de Movimientos | Almacén |
| 9 | Solicitudes de Material | Almacén |
| 10 | Catálogo de Productos | Almacén |
| 11 | Proveedores y Productos | Almacén |
| 12 | Entradas de Mercancía | Almacén |
| 13 | Pedidos Incompletos | Almacén |
| 14 | Solicitudes a Proveedores | Finanzas |
| 15 | Facturas Compras | Almacén, Finanzas |
| 16 | Gastos Operativos RTB | Finanzas |
| 17 | Verificador de Fechas Pedidos | Administración |

---

## Detalle de Cada Base

### 1. Reporte de Ventas
- **Áreas:** Ventas, Finanzas.
- **Métricas alimentadas:** Ventas totales, márgenes, ventas por cliente, ventas por producto, ventas aprobadas vs. canceladas, diferencias vs. PO.

### 2. Cotizaciones a Clientes
- **Áreas:** Ventas, Finanzas, Administración.
- **Métricas alimentadas:** Tasa de conversión cotización-venta, tiempo de aprobación, ventas por cliente y producto, trazabilidad de eventos.

### 3. Cotizaciones Canceladas
- **Áreas:** Ventas, Finanzas.
- **Métricas alimentadas:** Total y motivos de cancelación, tiempo promedio de cancelación, cancelaciones por cliente.

### 4. Pedidos de Clientes
- **Áreas:** Ventas, Administración.
- **Métricas alimentadas:** Trazabilidad completa del pedido y sus etapas; relación con cotizaciones.

### 5. Crecimiento de Inventario
- **Área:** Almacén.
- **Métricas alimentadas:** Monto total, productos activos vs. sin movimiento, clasificación ABC, variación del valor del inventario, predicciones de crecimiento, productos obsoletos.

### 6. No Conformes
- **Área:** Almacén.
- **Métricas alimentadas:** Cantidad y motivos de no conformidades, distribución por tipo, tiempo de resolución, predicciones de no conformidades.

### 7. Gestión de Inventario
- **Área:** Almacén.
- **Métricas alimentadas:** Impacto en inventario por ajustes y por movimientos; soporte a planificación de reabastecimiento.

### 8. Bitácora de Movimientos
- **Área:** Almacén.
- **Métricas alimentadas:** Total de movimientos, distribución por tipo, impacto en inventario, tiempo promedio de movimiento, predicciones.

### 9. Solicitudes de Material
- **Área:** Almacén.
- **Métricas alimentadas:** Cantidad solicitada, distribución por estado, costo total, materiales con baja rotación, predicciones.

### 10. Catálogo de Productos
- **Área:** Almacén.
- **Métricas alimentadas:** Demanda histórica 90/180 días, TDP, identificación de baja rotación.

### 11. Proveedores y Productos
- **Área:** Almacén.
- **Métricas alimentadas:** Costo unitario para solicitudes y entradas de mercancía.

### 12. Entradas de Mercancía
- **Área:** Almacén.
- **Métricas alimentadas:** Desviación cantidad solicitada vs. llegada, costo total de entradas, porcentaje de entrega completa, estado de entrada, proyecciones.

### 13. Pedidos Incompletos
- **Área:** Almacén.
- **Métricas alimentadas:** Total y distribución por motivo de incompletitud.

### 14. Solicitudes a Proveedores
- **Área:** Finanzas.
- **Métricas alimentadas:** Distribución de pedidos por estado, tiempos de recolección y envío, subtotales por proveedor, proyecciones.

### 15. Facturas Compras
- **Áreas:** Almacén, Finanzas.
- **Métricas alimentadas:** Total de facturación por proveedor, distribución por estado, tiempo promedio de pago, costos de envío y descuentos, porcentaje de facturación entregada correctamente, status y tipo de pago de entradas, proyecciones.

### 16. Gastos Operativos RTB
- **Área:** Finanzas.
- **Métricas alimentadas:** Total de gastos por categoría, por proveedor y deducibles; distribución por estado y método de pago; proyecciones.

### 17. Verificador de Fechas Pedidos
- **Área:** Administración.
- **Métricas alimentadas:** Tiempo promedio de procesamiento por etapa, porcentaje de retrasos, frecuencia de activación de automatización, proyecciones.

---

## Cruces Inter-Área Importantes

- **Ventas ↔ Finanzas:** `Reporte de Ventas`, `Cotizaciones a Clientes` y `Cotizaciones Canceladas` se consumen desde ambas áreas. Asegurar consistencia entre dashboards.
- **Almacén ↔ Finanzas:** `Facturas Compras` alimenta tanto el análisis de entradas (Almacén) como el de facturación de proveedores (Finanzas).
- **Ventas ↔ Administración:** `Cotizaciones a Clientes` y `Pedidos de Clientes` se utilizan también en Administración para correlacionar eventos del flujo de trabajo con pedidos específicos.
- **Almacén interno:** `Solicitudes de Material` y `Entradas de Mercancía` se complementan para planificación de reabastecimiento.

---

## Notas para Integración con n8n
- Cada base de datos debe contar con un flujo de actualización automática que genere/refresque su CSV correspondiente en la carpeta de datos.
- El estado de cada flujo debe reportarse al dashboard general (completado / en proceso / error).
- Filtros de fecha y categoría aplicables sobre los CSV deben ser consistentes con el esquema de cada base.
