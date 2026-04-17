# Página de Proveedores (`/proveedores`)

**Propósito:** Análisis del desempeño de proveedores — compras, tiempos de entrega, eficiencia, estados de pedidos, facturas y proyecciones.

> **Nota de cobertura:** Esta página integra el análisis de **Solicitudes a Proveedores** y **Facturas Compras** del contexto de Finanzas, además de las métricas tradicionales de Proveedores. Esto evita duplicar tableros entre Finanzas y Proveedores.

---

## 1. Encabezado
- Título: "Proveedores y Compras".
- Última actualización de los flujos n8n de `Solicitudes a Proveedores` y `Facturas Compras`.
- Migas de pan: Dashboard › Proveedores.

---

## 2. KPIs Resumen (cards superiores)

| KPI | Fórmula |
|-----|---------|
| Compras Totales del Periodo | `Suma de subtotales de pedidos` |
| Total Facturado | `Suma de facturas compras` |
| Tiempo Promedio de Entrega | `(Fecha recepción − Fecha envío) / Total entregas` |
| Tiempo Promedio de Recolección | `(Fecha recolección − Fecha confirmación)` |
| Tiempo Promedio entre Generación y Envío | `Fecha envío − Fecha generación` |
| Tiempo Promedio de Pago | `Fecha pago − Fecha factura` |
| % Facturación Entregada Correctamente | `Facturas correctas / Total facturas × 100` |
| Eficiencia Promedio Proveedor | `Tiempo entre entrega y recepción` |

---

## 3. Sección A — Compras y Pedidos

### 3.1 Gráfico de Barras — Total de Compras por Proveedor
- **Eje X:** Proveedores (top N).
- **Eje Y:** Monto MXN.
- **Fórmula:** `Suma de subtotales de pedidos por proveedor`.

### 3.2 Gráfico Circular — Distribución de Pedidos por Estado
- **Estados:** revisión, recolectada, enviada, recibida, cancelada, etc.
- **Fórmula:** `(Pedidos por estado / Total pedidos) × 100`.

### 3.3 Gráfico de Barras — Subtotal de Pedidos por Proveedor
- Comparativo mensual.

---

## 4. Sección B — Tiempos y Eficiencia

### 4.1 Gráfico de Líneas — Tiempo Promedio de Entrega por Proveedor
- **Eje X:** Tiempo (semanas).
- **Eje Y:** Días promedio.
- **Una línea por proveedor** (top N).

### 4.2 Gráfico de Dispersión — Eficiencia del Proveedor
- **Eje X:** Volumen de compras MXN.
- **Eje Y:** Tiempo entre entrega y recepción.
- **Color:** Tasa de errores / no conformidades.
- Identifica proveedores Premium (alto volumen, alta eficiencia) vs. Riesgo (bajo, lento).

### 4.3 Gráfico de Barras — Tiempo Promedio de Recolección por Proveedor
- **Fórmula:** `(Fecha recolección − Fecha confirmación)`.

### 4.4 Gráfico de Barras — Tiempo entre Generación y Envío del Pedido
- **Fórmula:** `(Fecha envío − Fecha generación)`.

---

## 5. Sección C — Facturación

### 5.1 Gráfico de Barras — Total de Facturación por Proveedor
- Top N proveedores.

### 5.2 Gráfico Circular — Distribución de Facturas por Estado
- Facturada, en proceso de cancelación, cancelada.

### 5.3 Card — Tiempo Promedio de Pago
- Tendencia mes a mes.

### 5.4 Tabla — Costos de Envío y Descuentos Aplicados
- Columnas: Factura | Proveedor | Costo de envío | Descuentos | IVA | Subtotal | Total.

### 5.5 Gauge — % Facturación Entregada Correctamente
- **Fórmula:** `Facturas correctas / Total facturas × 100`.

---

## 6. Sección D — Solicitudes y Entradas Relacionadas

### 6.1 Tabla — Solicitudes Activas a Proveedores
- Estado, costo, ETA, días en cada etapa.

### 6.2 Gráfico de Líneas — Desviación entre Cantidad Solicitada y Cantidad Llegada
- Vínculo cruzado con la página de Inventarios para detalle.

---

## 7. Sección E — Proyecciones

### 7.1 Gráfico de Líneas — Proyección de Pedidos por Estado
- Estimación de cómo se distribuirán pedidos en el futuro.

### 7.2 Gráfico de Líneas — Proyección de Tiempos de Recolección
- Por proveedor con bandas de confianza.

### 7.3 Gráfico de Barras — Proyección de Subtotales de Pedidos por Proveedor
- Próximos N periodos.

### 7.4 Tabla — Proyección de Tiempo entre Generación y Envío
- Por proveedor.

### 7.5 Gráfico de Líneas — Proyección de Facturación Futura por Proveedor
- Estimación basada en historial.

### 7.6 Gráfico de Barras — Proyección de IVA y Descuentos Futuros
- Impacto fiscal estimado.

### 7.7 Gráfico Circular — Proyección de Estado de Factura
- Distribución estimada en el futuro.

### 7.8 Card — Proyección del Tiempo de Pago Futuro
- Basado en comportamiento histórico.

---

## 8. Filtros de la Página

- Rango de fechas.
- Proveedor (autocomplete).
- Tipo de producto.
- Estado del pedido.
- Estado de la factura.
- Status de pago.
- Tipo de pago.

---

## 9. Funcionalidades

- Botón **Actualizar datos de Proveedores** (ejecuta flujos n8n de `Solicitudes a Proveedores` y `Facturas Compras`).
- Botón **Generar Reporte de Proveedores** (DOCX/PDF).
- Botón **Descargar CSV** filtrado.
- Botón **Enviar reporte por correo**.
- **Scorecard automático por proveedor** descargable individualmente.

---

## 10. Bases de Datos Consumidas
- Solicitudes a Proveedores
- Facturas Compras
- Entradas de Mercancía (vínculo con Inventarios)
- Proveedores y Productos
