# Página de Ventas (`/ventas`)

**Propósito:** Análisis profundo del área comercial — clientes, productos, márgenes, ciclos de cotización, conversiones y proyecciones.

---

## 1. Encabezado
- Título: "Análisis de Ventas".
- Última actualización + estado del flujo n8n para `Reporte de Ventas`, `Cotizaciones a Clientes`, `Cotizaciones Canceladas`.
- Migas de pan: Dashboard › Ventas.

---

## 2. KPIs Resumen (cards superiores)

| KPI | Fórmula |
|-----|---------|
| Ventas Totales | `Suma de subtotales del periodo` |
| Margen Bruto | `Subtotal − Costo de Compra` |
| % Margen | `Margen Bruto / Subtotal × 100` |
| % Aprobadas | `Ventas con estado "Aprobada" / Total de ventas × 100` |
| Tiempo Promedio de Aprobación | `Fecha de aprobación − Fecha de creación` |
| Tiempo Promedio de Pago | `Fecha de pago − Fecha de emisión` |
| Tasa de Conversión Cotización → Venta | `Cotizaciones aprobadas / Cotizaciones generadas × 100` |
| Diferencia vs. PO Acumulada | `Subtotal − Subtotal en PO` |

---

## 3. Sección A — Análisis Histórico

### 3.1 Gráfico de Barras — Ventas por Cliente
- **Eje X:** Top N clientes.
- **Eje Y:** Monto MXN.
- **Fórmula:** `Suma de subtotales por cliente`.
- **Filtro adicional:** Cliente Local vs. Foráneo (toggle).

### 3.2 Gráfico Circular — Distribución de Ventas por Producto
- **Datos:** Top N productos por monto + "Otros".
- **Fórmula:** `Subtotal por producto / Total × 100`.
- **Tooltip:** Cantidad vendida y precio promedio.

### 3.3 Gráfico de Líneas — Ventas Aprobadas vs. Canceladas (Histórico vs. Proyectado)
- **Eje X:** Meses (últimos 12 + próximos 3 proyectados).
- **Series:** Aprobadas, Canceladas, Proyección de ventas.
- **Línea vertical:** Frontera "hoy" entre histórico y proyección.

### 3.4 Gráfico de Barras — Margen Bruto por Producto
- **Eje X:** Top N productos.
- **Eje Y:** Margen MXN y % margen (eje secundario).
- **Fórmulas:** `Subtotal − Costo de Compra`, `Margen / Subtotal × 100`.

### 3.5 Gráfico de Barras Apiladas — Demanda Histórica vs. Empacada por Producto
- **Series:** Cantidad solicitada, cantidad empacada, cantidad pendiente.
- **Cobertura del contexto:** Demanda de Productos (Histórica) en Ventas y Demanda de Productos Faltantes en Almacén.

---

## 4. Sección B — Tiempos y Rentabilidad

### 4.1 Gráfico de Líneas — Tiempo de Aprobación de Cotizaciones
- **Eje X:** Tiempo (semanas).
- **Eje Y:** Días promedio.
- **Línea de meta** opcional configurable.

### 4.2 Gráfico de Líneas — Tiempo de Pago por Cliente
- Promedio agrupado por cliente y tipo de pago.

### 4.3 Tabla de Descuentos Otorgados
- Columnas: Cliente | Producto | Descuento aplicado | Total cotización | % descuento sobre subtotal.
- **Fórmula:** `Descuento promedio por cliente o producto`.

---

## 5. Sección C — Clientes (Locales vs. Foráneos)

### 5.1 Gráfico de Barras Apiladas — Ventas por Tipo de Cliente
- Series: Locales y Foráneos.
- **Fórmulas:** `(Ventas locales / Ventas totales)` y `(Ventas foráneas / Ventas totales)`.

### 5.2 Gráfico de Barras — Venta Promedio por Cliente
- Comparativo Locales vs. Foráneos.
- **Fórmula:** `Ventas totales por tipo / Número de clientes por tipo`.

### 5.3 Gráfico de Líneas — Tasa de Crecimiento por Tipo de Cliente
- **Fórmula:** `((Ventas actuales − Ventas mismo periodo año pasado) / Ventas año pasado) × 100`.

---

## 6. Sección D — Ventas Cerradas Mes a Mes

### 6.1 Gráfico de Barras — Ventas Cerradas por Mes (Cantidad y Monto)
- Doble eje: Cantidad de productos (eje izq.) y Monto MXN (eje der.).

### 6.2 Indicador — Variación Mes a Mes
- **Fórmula:** `((Ventas mes actual − Ventas mes anterior) / Ventas mes anterior) × 100`.
- Visual: card con flecha verde/roja.

---

## 7. Sección E — Proyecciones

### 7.1 Gráfico de Líneas — Proyección de Ventas Futura
- Modelo: series temporales sobre histórico de ventas.
- Bandas de confianza (alta/baja).

### 7.2 Gráfico de Barras — Proyección de Ingresos por Cliente
- Top N clientes con mayor potencial proyectado.

### 7.3 Gráfico de Líneas — Proyección de Margen Bruto Futuro
- Basado en márgenes históricos.

### 7.4 Tabla — Clientes en Riesgo de Abandono
- Columnas: Cliente | Ventas actuales | Ventas periodo anterior | Δ% | Última compra.
- **Fórmula:** `Clientes con bajas tasas de compra comparados con periodos anteriores`.

### 7.5 Tabla — Tendencia de Pagos (Predicción)
- **Fórmula:** `Promedio de tiempo de pago anterior` por cliente con clasificación de riesgo.

---

## 8. Sección F — Tasas y Tiempos de Conversión

### 8.1 Funnel Chart — Cotización → Aprobada → Empacada → Pagada
- Conteo y monto en cada etapa.

### 8.2 Tabla — Tasas de Conversión
| Métrica | Valor |
|---------|-------|
| Cotización → Venta | `Aprobadas / Generadas × 100` |
| Por tipo de cliente (Local) | `% Aprobadas Locales` |
| Por tipo de cliente (Foráneo) | `% Aprobadas Foráneas` |
| Por producto top N | `% Aprobadas por producto` |

### 8.3 Tabla — Tiempos de Conversión
| Métrica | Valor |
|---------|-------|
| Tiempo promedio de cierre global | promedio en días |
| Tiempo de cierre — Locales | promedio en días |
| Tiempo de cierre — Foráneos | promedio en días |

---

## 9. Filtros de la Página

- Rango de fechas (preset y libre).
- Cliente (autocomplete).
- Tipo de cliente: Local / Foráneo / Ambos.
- Producto / Categoría.
- Estado de cotización: Aprobada / Cancelada / Pendiente.

---

## 10. Funcionalidades

- Botón **Actualizar datos de Ventas** (dispara flujo n8n específico de esta área).
- Botón **Generar Reporte de Ventas** (DOCX/PDF) con secciones seleccionables.
- Botón **Descargar CSV** filtrado.
- Botón **Enviar reporte por correo** con destinatarios.

---

## 11. Bases de Datos Consumidas
- Reporte de Ventas
- Cotizaciones a Clientes
- Cotizaciones Canceladas
- Pedidos de Clientes (para conversión y empaque)
