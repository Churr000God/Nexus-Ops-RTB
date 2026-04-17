# Página de Inventarios (`/inventarios`)

**Propósito:** Control operativo del almacén — crecimiento de inventario, clasificación ABC, productos no conformes, bitácora de movimientos, solicitudes de material, entradas de mercancía y pedidos incompletos.

> **Nota de cobertura:** Esta página absorbe todas las métricas del contexto de **Almacén** (ver `contexto/02_almacen.md`). El alcance es más amplio que el simple "Inventarios" porque el área de Almacén incluye seis subdominios.

---

## 1. Encabezado
- Título: "Control de Inventarios y Almacén".
- Última actualización de cada flujo n8n asociado.
- Migas de pan: Dashboard › Inventarios.

---

## 2. KPIs Resumen (cards superiores)

| KPI | Fórmula |
|-----|---------|
| Valor Total de Inventario | `Suma de montos de productos activos y no activos` |
| Diferencia Stock Real vs. Teórico | `Cantidad real − Cantidad teórica` |
| % Productos Activos | `Monto productos activos / Monto total × 100` |
| Total No Conformes | `Suma de cantidades de productos no conformes` |
| Tiempo Promedio de Resolución (No Conformes) | `Fecha resolución − Fecha detección` |
| Total Movimientos del Periodo | `Cantidad Entrante + Cantidad Salida` |
| % Entrega Completa (Mercancía) | `Cantidad llegada / Cantidad solicitada × 100` |
| Total Pedidos Incompletos | Conteo |

---

## 3. Sección A — Crecimiento de Inventario

### 3.1 Gráfico de Barras — Stock Real vs. Stock Teórico por Producto
- **Eje X:** Productos (top N).
- **Eje Y:** Cantidad.
- **Series:** Stock real (azul), Stock teórico (naranja).
- **Fórmula:** `Cantidad real − Cantidad teórica`.

### 3.2 Gráfico Circular — Clasificación ABC de Productos
- **Criterios:** `A ≥ $50k`, `B ≥ $10k`, `C < $10k` (rotación y monto).
- **Datos:** Clasificación ABC.

### 3.3 Gráfico de Líneas — Días Sin Movimiento
- **Eje X:** Productos.
- **Eje Y:** Días desde la última salida.
- **Fórmula:** `Días desde la última salida de producto`.

### 3.4 Gráfico de Barras — Demanda Histórica (90/180 días)
- **Eje X:** Productos (top N).
- **Fórmula:** `Suma de cantidad solicitada por producto en el periodo 90-180 días`.

### 3.5 Gráfico de Barras Apiladas — Productos Activos vs. Sin Movimiento
- **Fórmula:** `(Monto Productos Activos) − (Monto Productos Sin Movimiento)`.

### 3.6 Gráfico de Líneas — Variación del Valor del Inventario
- **Fórmula:** `Variación = (Monto Final) − (Monto Inicial)`.

---

## 4. Sección B — No Conformes

### 4.1 Gráfico de Barras — Cantidad Total de Productos No Conformes
- Segmentado por producto.

### 4.2 Gráfico Circular — Distribución de No Conformidades por Motivo
- **Fórmula:** `(Productos con ese motivo / Total no conformes) × 100`.

### 4.3 Tabla — Impacto en Inventario por Ajustes
- Columnas: Producto | Motivo | Ajuste inventario | Acción tomada | Impacto monetario.

### 4.4 Card — Tiempo Promedio de Resolución
- **Fórmula:** `(Fecha de resolución − Fecha de detección)`.

---

## 5. Sección C — Bitácora de Movimientos

### 5.1 Gráfico de Barras Apiladas — Total Movimientos por Periodo
- Series: Entradas vs. Salidas.
- **Fórmula:** `Cantidad Entrante + Cantidad Salida`.

### 5.2 Gráfico Circular — Distribución de Movimientos por Tipo
- **Fórmula:** `(Cantidad por tipo / Total movimientos) × 100`.

### 5.3 Gráfico de Líneas — Impacto Neto en Inventario
- **Fórmula:** `Cantidad Entrante − Cantidad Salida`.

### 5.4 Card — Tiempo Promedio de Movimiento
- **Fórmula:** `(Fecha de Salida − Fecha de Entrada) / Número de Movimientos`.

### 5.5 Tabla Detallada — Bitácora
- Columnas: Fecha | Producto | Tipo | Cantidad | Origen | Destino.

---

## 6. Sección D — Solicitudes de Material

### 6.1 Gráfico de Barras — Cantidad Total Solicitada
- Por producto o proveedor.

### 6.2 Gráfico Circular — Distribución de Solicitudes por Estado
- **Fórmula:** `(Solicitudes por estado / Total solicitudes) × 100`.

### 6.3 Card — Costo Total de Solicitudes
- **Fórmula:** `Costo Unitario × Cantidad Solicitada`.

### 6.4 Tabla — Materiales con Baja Rotación
- Demanda histórica 90/180 días, TDP, alerta si baja rotación.

---

## 7. Sección E — Entradas de Mercancía

### 7.1 Gráfico de Barras — Desviación Solicitado vs. Llegado
- **Fórmula:** `Cantidad solicitada − Cantidad llegada`.

### 7.2 Card — Costo Total de Entradas
- **Fórmula:** `Costo Unitario × Cantidad llegada`.

### 7.3 Gauge — % Entrega Completa
- **Fórmula:** `(Cantidad llegada / Cantidad solicitada) × 100`.

### 7.4 Tabla — Estado de Entradas
- Columnas: Proveedor | Estado | Status de pago | Tipo de pago | Fecha esperada | Fecha real.

---

## 8. Sección F — Pedidos Incompletos

### 8.1 Card — Total de Pedidos Incompletos
- Conteo con variación vs. periodo anterior.

### 8.2 Gráfico Circular — Distribución por Motivo de Incompletitud
- **Fórmula:** `(Pedidos por motivo / Total incompletos) × 100`.

### 8.3 Tabla — Detalle de Pedidos Incompletos
- Columnas: Pedido | Cliente | Producto faltante | Motivo | Antigüedad.

---

## 9. Sección G — Proyecciones

### 9.1 Gráfico de Líneas — Predicción de Crecimiento del Inventario
- Promedio móvil u otros métodos de series temporales.

### 9.2 Tabla — Proyección de Productos Sin Movimiento y Obsoletos
- Análisis predictivo con rotación y antigüedad.

### 9.3 Tabla — Planificación de Reabastecimiento
- **Fórmula:** `Reabastecimiento = Stock Actual + Demanda Proyectada − Stock Mínimo`.

### 9.4 Gráfico de Líneas — Predicción de No Conformidades
- Basado en análisis de tendencias.

### 9.5 Tabla — Proyección de Causas de No Conformidades
- Identifica motivos más probables en el futuro.

### 9.6 Gráfico de Líneas — Predicción de Movimientos de Inventario
- Proyección de entradas y salidas.

### 9.7 Tabla — Predicción de Solicitudes de Material y Materiales con Baja Rotación
- Con costos proyectados.

### 9.8 Gráfico de Líneas — Proyección de Entradas de Mercancía y Costo Total
- **Fórmula:** `Costo Unitario proyectado × Cantidad proyectada`.

---

## 10. Filtros de la Página

- Rango de fechas.
- Categoría de producto.
- Clasificación ABC (A / B / C).
- Tipo de producto (Activo / Sin Movimiento / Obsoleto).
- Estado (aplicable a solicitudes, entradas, pedidos).
- Proveedor (donde aplique).

---

## 11. Funcionalidades

- Botón **Actualizar datos de Inventarios** (ejecuta flujos n8n de todas las bases del área).
- Botón **Generar Reporte de Inventarios** (DOCX/PDF).
- Botón **Descargar CSV** filtrado.
- Botón **Enviar reporte por correo**.
- Alertas automáticas: productos bajo stock mínimo, no conformes sin resolver > X días, pedidos incompletos > Y días.

---

## 12. Bases de Datos Consumidas
- Crecimiento de Inventario
- No Conformes
- Gestión de Inventario
- Bitácora de Movimientos
- Solicitudes de Material
- Catálogo de Productos
- Proveedores y Productos
- Entradas de Mercancía
- Facturas Compras (para status/tipo de pago de entradas)
- Pedidos Incompletos
