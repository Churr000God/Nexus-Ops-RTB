# Página de Gastos (`/gastos`)

**Propósito:** Visualización y control de gastos operativos RTB — distribución por categoría, proveedor, método de pago, gastos deducibles vs. no deducibles, y proyecciones.

---

## 1. Encabezado
- Título: "Gastos Operativos RTB".
- Última actualización del flujo n8n para `Gastos Operativos RTB`.
- Migas de pan: Dashboard › Gastos.

---

## 2. KPIs Resumen (cards superiores)

| KPI | Fórmula |
|-----|---------|
| Total de Gastos del Periodo | `Suma de gastos del periodo` |
| Gastos Deducibles | `Suma de gastos deducibles` |
| % Deducibles | `Gastos deducibles / Total × 100` |
| Categoría con Mayor Gasto | Categoría top |
| Proveedor con Mayor Gasto | Proveedor top |
| Variación vs. Periodo Anterior | `((Actual − Anterior) / Anterior) × 100` |

---

## 3. Sección A — Distribución de Gastos

### 3.1 Gráfico Circular — Distribución por Categoría
- **Categorías:** Renta, Servicios, Transporte, Mantenimiento, Honorarios, etc.
- **Fórmula:** `Suma de gastos en cada categoría / Total × 100`.

### 3.2 Gráfico de Barras — Gastos por Proveedor
- **Eje X:** Top N proveedores.
- **Eje Y:** Monto MXN.
- **Fórmula:** `Suma de gastos con cada proveedor`.

### 3.3 Gráfico de Líneas — Gastos a lo Largo del Tiempo
- **Eje X:** Periodo (semanas o meses).
- Una línea por categoría.

### 3.4 Gráfico de Barras — Comparación Deducibles vs. No Deducibles
- **Fórmula:** `Suma de gastos deducibles / Total de gastos`.

---

## 4. Sección B — Estado y Métodos de Pago

### 4.1 Gráfico Circular — Distribución por Estado
- Estados: pendiente, en proceso, realizado.
- **Fórmula:** `(Gastos por estado / Total) × 100`.

### 4.2 Gráfico Circular — Distribución por Método de Pago
- **Métodos:** Transferencia, Tarjeta, Efectivo, Cheque, etc.

### 4.3 Tabla — Detalle de Gastos del Periodo
- Columnas: Fecha | Categoría | Proveedor | Concepto | Monto | Estado | Método de pago | Deducible (Sí/No).

---

## 5. Sección C — Proyecciones

### 5.1 Gráfico de Líneas — Proyección de Gastos por Categoría
- Estimación de gastos futuros por categoría.

### 5.2 Gráfico de Barras — Proyección de Gastos por Proveedor
- Top N proveedores proyectados.

### 5.3 Gráfico de Líneas — Proyección de Gastos Deducibles
- Estimación del componente deducible futuro.

### 5.4 Gráfico Circular — Proyección de Distribución por Estado
- Cómo se distribuirán los gastos futuros.

---

## 6. Filtros de la Página

- Rango de fechas.
- Categoría (multi-select).
- Proveedor (autocomplete).
- Estado (pendiente / en proceso / realizado).
- Método de pago.
- Deducible (Sí / No / Todos).

---

## 7. Funcionalidades

- Botón **Actualizar datos de Gastos** (ejecuta flujo n8n específico).
- Botón **Generar Reporte de Gastos** (DOCX/PDF) — incluye desglose deducible para fiscal.
- Botón **Descargar CSV** filtrado.
- Botón **Enviar reporte por correo**.
- **Alertas presupuestarias:** notificar si una categoría supera un umbral configurable.

---

## 8. Bases de Datos Consumidas
- Gastos Operativos RTB
