# Sugerencias de Mejora y Matriz de Cobertura de Métricas

**Propósito:** Documentar dónde la estructura propuesta deja métricas del contexto sin un hogar obvio, y sugerir ampliaciones. Incluye la matriz de trazabilidad `métrica → página` que demuestra que ninguna métrica queda sin cobertura.

---

## 1. Sugerencias de Ampliación

### 1.1 Agregar Página de Administración (`/administracion`) — **RECOMENDADO**

**Por qué:** El contexto del área de Administración define métricas importantes alrededor del **Verificador de Fechas Pedidos** (tiempos por etapa, retrasos, activación de automatizaciones). La propuesta de páginas original no las cubre en ninguna página.

**Contenido propuesto:**
- **KPIs:** Tiempo promedio por etapa, % pedidos con retraso, automatizaciones activadas en el periodo.
- **Gráfico de Gantt/Barras horizontales:** Tiempo por cada etapa del pedido.
- **Gráfico de Líneas:** Evolución del % retrasos por etapa.
- **Gráfico Circular:** Frecuencia de activación de automatización por tipo.
- **Gráfico de Barras:** Automatizaciones por persona que las activó.
- **Proyecciones:** tiempos futuros, % retrasos futuros, activaciones futuras.
- **Filtros:** rango de fechas, tipo de etapa, persona activadora.
- **Base:** Verificador de Fechas Pedidos, Cotizaciones a Clientes, Pedidos de Clientes.

### 1.2 Considerar Subpágina / Sección de Cotizaciones dentro de Ventas — **OPCIONAL**

**Por qué:** Las métricas de `Cotizaciones Canceladas` (total por motivo, tiempo de cancelación, cancelaciones por cliente, proyecciones) son suficientes para justificar una sección dedicada, no solo un tab dentro de Ventas.

**Alternativas:**
- (a) Mantener dentro de la página de Ventas como una sección expandible (propuesta actual).
- (b) Crear subpágina `/ventas/cotizaciones` con análisis dedicado de aprobadas, rechazadas y canceladas.

**Recomendación:** opción (a) para fase 1; reevaluar si el volumen de cancelaciones lo amerita.

### 1.3 Agregar Funnel de Ventas Explícito — **RECOMENDADO**

**Por qué:** Las tasas y tiempos de conversión del contexto de Ventas se entienden mejor con un funnel visual: Cotización → Aprobada → Empacada → Pagada.

**Dónde:** Ya incluido en la Sección F de la página de Ventas. Destacarlo en el Dashboard general.

### 1.4 Crear Scorecard Individual por Proveedor y por Cliente — **OPCIONAL**

**Por qué:** Mejora la toma de decisiones operativas. Descargable en DOCX para negociaciones.

### 1.5 Centro de Alertas Consolidado — **RECOMENDADO**

**Por qué:** Varias páginas generan alertas (productos bajo mínimo, no conformes sin resolver, pedidos incompletos antiguos, errores de n8n, umbrales de gasto). Un centro unificado evita que se pierdan entre pestañas.

**Dónde:** componente en el header visible en todas las páginas.

---

## 2. Matriz de Trazabilidad Métrica → Página

Esta matriz garantiza que **ninguna métrica del contexto quede sin un hogar** en el diseño de páginas. Si falta cobertura, se corrige.

### 2.1 Métricas del Área de Ventas

| Métrica | Página Destino | Sección |
|---------|---------------|---------|
| Ventas por Cliente | Ventas | A.3.1 |
| Ventas por Producto | Ventas | A.3.2 |
| Demanda de Productos (Histórica) | Ventas | A.3.5 |
| Tiempo de Aprobación de Cotizaciones | Ventas | B.4.1 |
| Tiempo de Pago | Ventas | B.4.2 |
| Margen de Ganancia por Producto | Ventas | A.3.4 |
| Descuentos Otorgados | Ventas | B.4.3 |
| Predicción de Ventas por Producto | Ventas | E.7.1 |
| Demanda de Productos Faltantes | Inventarios | D.6 + G.9.3 |
| Proyección de Ingresos por Cliente | Ventas | E.7.2 |
| Proyección de Ventas por Periodo | Ventas | E.7.1 |
| Tendencia de Pagos | Ventas | E.7.5 |
| Clientes en Riesgo de Abandono | Ventas | E.7.4 |
| Ventas por Tipo de Cliente (Locales/Foráneos) | Ventas | C.5.1 |
| Venta Promedio por Cliente (Locales/Foráneos) | Ventas | C.5.2 |
| Tasa de Crecimiento por Tipo de Cliente | Ventas | C.5.3 |
| Ventas Cerradas por Mes (Cantidad y Monto) | Ventas | D.6.1 |
| Comparación Mes a Mes | Ventas | D.6.2 + Dashboard KPI |
| Tasas de Conversión (todas) | Ventas | F.8.1 / F.8.2 |
| Tiempos de Conversión (todos) | Ventas | F.8.3 |

### 2.2 Métricas del Área de Almacén

| Métrica | Página Destino | Sección |
|---------|---------------|---------|
| Monto Total de Inventario | Inventarios | KPI + A.3 |
| Productos Activos vs. Sin Movimiento | Inventarios | A.3.5 |
| Clasificación ABC | Inventarios | A.3.2 |
| Variación del Valor del Inventario | Inventarios | A.3.6 |
| Predicción de Crecimiento del Inventario | Inventarios | G.9.1 |
| Proyección de Productos Sin Movimiento | Inventarios | G.9.2 |
| Planificación de Reabastecimiento | Inventarios | G.9.3 |
| Proyección de Productos Obsoletos | Inventarios | G.9.2 |
| Cantidad Total de Productos No Conformes | Inventarios | B.4.1 |
| Distribución de No Conformidades por Tipo | Inventarios | B.4.2 |
| Impacto en Inventario por Ajustes | Inventarios | B.4.3 |
| Tiempo Promedio de Resolución | Inventarios | B.4.4 |
| Predicción de No Conformidades | Inventarios | G.9.4 |
| Proyección de Ajustes de Inventario | Inventarios | G.9.4 |
| Proyección de Causas de No Conformidades | Inventarios | G.9.5 |
| Total de Movimientos de Inventario | Inventarios | C.5.1 |
| Distribución de Movimientos por Tipo | Inventarios | C.5.2 |
| Impacto de Movimientos en Inventario | Inventarios | C.5.3 |
| Tiempo Promedio de Movimiento | Inventarios | C.5.4 |
| Predicción de Movimientos | Inventarios | G.9.6 |
| Proyección de Movimientos por Tipo | Inventarios | G.9.6 |
| Predicción de Impacto en Inventario | Inventarios | G.9.6 |
| Cantidad Total Solicitada de Material | Inventarios | D.6.1 |
| Distribución de Solicitudes por Estado | Inventarios | D.6.2 |
| Costo Total de Solicitudes | Inventarios | D.6.3 |
| Materiales con Baja Rotación | Inventarios | D.6.4 |
| Predicción de Solicitudes | Inventarios | G.9.7 |
| Proyección de Costos de Solicitudes | Inventarios | G.9.7 |
| Predicción de Materiales con Baja Rotación | Inventarios | G.9.7 |
| Desviación Solicitada vs. Llegada | Inventarios | E.7.1 + Proveedores D.6.2 |
| Costo Total de Entradas | Inventarios | E.7.2 |
| % Entrega Completa | Inventarios | E.7.3 + KPI |
| Análisis de Estado de Entrada | Inventarios | E.7.4 |
| Proyección de Entradas de Mercancía | Inventarios | G.9.8 |
| Proyección de Costo Total de Entradas | Inventarios | G.9.8 |
| Total de Pedidos Incompletos | Inventarios | F.8.1 |
| Distribución de Pedidos Incompletos por Motivo | Inventarios | F.8.2 |

### 2.3 Métricas del Área de Finanzas

| Métrica | Página Destino | Sección |
|---------|---------------|---------|
| Ventas Totales por Período | Dashboard + Ventas | KPIs |
| Margen Bruto por Venta | Dashboard + Ventas | KPI + A.3.4 |
| Porcentaje de Margen por Venta | Dashboard + Ventas | KPI |
| Ventas con Diferencia vs. PO | Dashboard + Ventas | KPI |
| Ventas por Cliente | Ventas | A.3.1 |
| Porcentaje de Ventas Aprobadas | Ventas | KPI + A.3.3 |
| Proyección de Ventas Futura | Ventas | E.7.1 |
| Proyección de Margen Bruto Futuro | Ventas | E.7.3 |
| Proyección de Ventas con Diferencia vs. PO | Ventas | E (nueva tarjeta) |
| Proyección de Porcentaje de Empaque | Ventas | E (nueva tarjeta) |
| Total de Cotizaciones Canceladas por Motivo | Ventas | A.3.3 (+ tabla de motivos) |
| Tiempo Promedio de Cancelación | Ventas | B (nueva tarjeta) |
| Cotizaciones Canceladas por Cliente | Ventas | A.3.1 (segmentación) |
| Proyección de Cotizaciones Canceladas | Ventas | E (nueva tarjeta) |
| Proyección de Motivos de Cancelación | Ventas | E (nueva tarjeta) |
| Proyección del Tiempo de Cancelación | Ventas | E (nueva tarjeta) |
| Distribución de Pedidos por Estado | Proveedores | A.3.2 |
| Tiempo Promedio de Recolección | Proveedores | KPI + B.4.3 |
| Tiempo Promedio Entre Generación y Envío | Proveedores | KPI + B.4.4 |
| Subtotal de Pedidos por Proveedor | Proveedores | A.3.3 |
| Proyección de Pedidos por Estado | Proveedores | E.7.1 |
| Proyección de Tiempos de Recolección | Proveedores | E.7.2 |
| Proyección de Subtotales por Proveedor | Proveedores | E.7.3 |
| Proyección de Tiempo Entre Generación y Envío | Proveedores | E.7.4 |
| Total de Gastos por Categoría | Gastos | A.3.1 |
| Total de Gastos por Proveedor | Gastos | A.3.2 |
| Total de Gastos Deducibles | Gastos | KPI + A.3.4 |
| Distribución de Gastos por Estado | Gastos | B.4.1 |
| Distribución de Gastos por Método de Pago | Gastos | B.4.2 |
| Proyección de Gastos por Categoría | Gastos | C.5.1 |
| Proyección de Gastos por Proveedor | Gastos | C.5.2 |
| Proyección de Gastos Deducibles | Gastos | C.5.3 |
| Proyección de Gastos por Estado | Gastos | C.5.4 |
| Total de Facturación por Proveedor | Proveedores | C.5.1 |
| Distribución de Facturas por Estado | Proveedores | C.5.2 |
| Tiempo Promedio de Pago | Proveedores | C.5.3 |
| Costo Total de Envío y Descuentos | Proveedores | C.5.4 |
| % Facturación Entregada Correctamente | Proveedores | C.5.5 + KPI |
| Proyección de Facturación Futura | Proveedores | E.7.5 |
| Proyección de IVA y Descuentos | Proveedores | E.7.6 |
| Proyección de Estado de Factura | Proveedores | E.7.7 |
| Proyección del Tiempo de Pago | Proveedores | E.7.8 |

### 2.4 Métricas del Área de Administración

| Métrica | Página Destino | Sección |
|---------|---------------|---------|
| Tiempo promedio de procesamiento por etapa | **Administración (sugerida)** | Históricos |
| Porcentaje de retrasos en cada etapa | **Administración (sugerida)** | Históricos |
| Frecuencia de activación de automatización | **Administración (sugerida)** | Históricos |
| Proyección del tiempo de procesamiento | **Administración (sugerida)** | Proyecciones |
| Proyección del porcentaje de retrasos | **Administración (sugerida)** | Proyecciones |
| Proyección de activación de automatización | **Administración (sugerida)** | Proyecciones |

> **Si no se aprueba la página de Administración**, estas métricas pueden integrarse como sección dentro del Dashboard general o como subpágina `/admin/flujos` dependiente de la administración del sistema.

---

## 3. Métricas del Contexto que Requieren Confirmación

Algunos elementos del contexto necesitan validación antes de implementarse:

1. **Umbrales de clasificación ABC** (`A ≥ $50k`, `B ≥ $10k`, `C < $10k`) — confirmar si aplican o cambian según línea de producto.
2. **Proyección de Porcentaje de Empaque** — aclarar si se calcula como `(Cantidad empacada / Cantidad aprobada) × 100` proyectado.
3. **Tiempo de Movimiento** — confirmar si `Fecha de Salida − Fecha de Entrada` se refiere a todo el ciclo o a un movimiento específico.
4. **Clientes Locales vs. Foráneos** — confirmar el criterio (CP, municipio, país).
5. **Stock Mínimo** — confirmar si se gestiona por producto, por categoría o con regla global.

---

## 4. Próximos Pasos Sugeridos

1. Confirmar si se aprueba la **Página de Administración** como la sexta página.
2. Responder las preguntas abiertas de la sección 3.
3. Decidir la prioridad de implementación de los módulos de reporte (DOCX/PDF) y envío por correo.
4. Definir qué flujos n8n existen hoy y cuáles hay que crear.
5. Validar el diseño visual preliminar (wireframes) antes de arrancar desarrollo.
