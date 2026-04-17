# Página Principal — Dashboard General (`/`)

**Propósito:** Vista ejecutiva consolidada de los indicadores más importantes de toda la operación. Punto de entrada del usuario y origen de la navegación.

---

## 1. Encabezado de Página

- **Título:** Nexus Ops RTB · Dashboard General
- **Fecha y hora de última actualización** de cada fuente de datos.
- **Estado del túnel Cloudflare** (badge verde/rojo + botón "Copiar enlace").
- **Indicador global de estado de automatización n8n:**
  - Verde: completado.
  - Amarillo: en proceso.
  - Rojo: error (con detalle clickable).

---

## 2. KPIs Resumen (cards superiores)

| KPI | Fórmula | Comparativo |
|-----|---------|-------------|
| Ventas Totales del Período | `Suma de subtotales de ventas` | vs. periodo anterior |
| Margen Bruto Acumulado | `Subtotal − Costo de Compra` | vs. proyectado |
| % Margen | `Margen Bruto / Subtotal × 100` | vs. mes anterior |
| % Ventas Aprobadas | `Ventas con estado "Aprobada" / Total de ventas × 100` | vs. mes anterior |
| Diferencia vs. PO | `Subtotal − Subtotal en PO` | acumulado del periodo |
| Valor Total de Inventario | `Suma de montos de inventario` | vs. mes anterior |
| Gastos Operativos del Período | `Suma de gastos por categoría` | vs. presupuesto |

---

## 3. Gráficos Principales

### 3.1 Gráfico de Barras — Ventas por Mes (Real vs. Proyectado)
- **Eje X:** Meses (últimos 12).
- **Eje Y:** Monto MXN.
- **Series:** Ventas reales (azul) y ventas proyectadas (naranja).
- **Fórmula real:** `Suma de subtotales por mes`.
- **Fórmula proyectada:** Series temporales sobre histórico.
- **Interacción:** Click en mes → drill al detalle de ese mes.

### 3.2 Gráfico de Líneas — Tendencia Histórica de Ventas
- **Eje X:** Periodo (mes a mes y trimestre a trimestre, selector).
- **Eje Y:** Monto MXN.
- **Series:** Ventas históricas + línea de tendencia.
- **Variación %:** `((Ventas mes actual − Ventas mes anterior) / Ventas mes anterior) × 100` mostrada en tooltip.

### 3.3 Gráfico Circular — Distribución de Ventas por Producto
- **Datos:** Top N productos por monto vendido + categoría "Otros".
- **Fórmula:** `Suma de subtotales por producto / Suma total × 100`.
- **Interacción:** Click en sector → ir a detalle de ese producto en página de Ventas.

### 3.4 Gráfico de Barras Apiladas — Demanda Histórica vs. Ventas Reales por Producto
- **Eje X:** Productos (top N).
- **Eje Y:** Cantidad.
- **Series:** Cantidad solicitada (apilada) y cantidad empacada / vendida.
- **Fórmula:** Demanda = `Suma de cantidad solicitada por producto`; Ventas reales = `Cantidad empacada por producto`.

---

## 4. Bloque "Estado del Sistema"

Panel lateral o inferior:
- **Estado del túnel Cloudflare:** activo / inactivo + última verificación.
- **Botón "Copiar enlace"** del túnel Cloudflare.
- **Estado de cada flujo n8n** (uno por base de datos):
  - Reporte de Ventas
  - Cotizaciones a Clientes
  - Cotizaciones Canceladas
  - Crecimiento de Inventario
  - Solicitudes de Material
  - Solicitudes a Proveedores
  - Facturas Compras
  - Gastos Operativos RTB
  - Verificador de Fechas Pedidos
- **Última ejecución exitosa** y **botón de re-ejecución manual**.

---

## 5. Botones de Funcionalidad

- **Actualizar Dashboards** → dispara todos los flujos n8n en paralelo.
- **Generar Reporte Ejecutivo (DOCX/PDF)** → reporte consolidado con KPIs y gráficos clave.
- **Descargar CSV consolidado** → empaquetado .zip con todos los CSV vigentes.
- **Enviar reporte por correo** → modal para destinatarios.

---

## 6. Filtros Aplicables

- Rango de fechas (selector de fechas o presets: hoy, 7d, 30d, MTD, QTD, YTD).
- Categoría de producto.
- Cliente (con búsqueda).
- Tipo de cliente (Local / Foráneo).

> Los filtros aplicados se propagan a todas las gráficas de la página y se conservan al navegar a páginas internas.

---

## 7. Bases de Datos Consumidas
- Reporte de Ventas
- Cotizaciones a Clientes
- Crecimiento de Inventario
- Gastos Operativos RTB
- Facturas Compras
- Verificador de Fechas Pedidos (para badge global de estado)
