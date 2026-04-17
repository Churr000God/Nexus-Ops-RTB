# Área de Almacén — Métricas y Análisis

**Propósito:** Definir métricas históricas y proyecciones para el control de inventario, no conformes, bitácora de movimientos, solicitudes de material, entradas de mercancía y pedidos incompletos.

---

## 1. Crecimiento de Inventario

### Históricos

#### 1. Monto Total de Inventario
- **Fórmula:** `Monto Total = Sumatoria de montos del inventario de productos activos y no activos`
- **Datos:** Monto (MXN)
- **Base:** Crecimiento de Inventario

#### 2. Productos Activos vs. Productos Sin Movimiento
- **Fórmula:** `(Monto Productos Activos) − (Monto Productos Sin Movimiento)`
- **Datos:** "Tipo" (Inventario, Productos sin movimiento)
- **Base:** Crecimiento de Inventario

#### 3. Clasificación ABC del Inventario
- **Fórmula:** Clasificación A, B, C según rotación.
- **Datos:** Clasificación ABC
- **Base:** Crecimiento de Inventario

#### 4. Variación del Valor del Inventario
- **Fórmula:** `Variación del Inventario = (Monto Final) − (Monto Inicial)`
- **Datos:** Monto de inventario
- **Base:** Crecimiento de Inventario

### Futuros

#### 1. Predicción de Crecimiento del Inventario
- **Fórmula:** Promedio móvil u otros métodos de series temporales.
- **Datos:** Monto del inventario
- **Base:** Crecimiento de Inventario

#### 2. Proyección de Productos Sin Movimiento
- **Fórmula:** Análisis predictivo con rotación histórica.
- **Datos:** "Tipo" de productos
- **Base:** Crecimiento de Inventario

#### 3. Planificación de Reabastecimiento
- **Fórmula:** `Reabastecimiento = (Stock Actual) + (Demanda Proyectada) − (Stock Mínimo)`
- **Datos:** Stock, Demanda futura, Stock mínimo
- **Base:** Crecimiento de Inventario, Entradas de Mercancía

#### 4. Proyección de Productos Obsoletos o Dormidos
- **Fórmula:** Clasificación de baja rotación.
- **Datos:** Clasificación de antigüedad
- **Base:** Crecimiento de Inventario

---

## 2. No Conformes

### Históricos

#### 1. Cantidad Total de Productos No Conformes
- **Fórmula:** `Cantidad total no conforme = Suma de cantidades de productos no conformes`
- **Datos:** Cantidad, Motivo
- **Base:** No Conformes

#### 2. Distribución de No Conformidades por Tipo
- **Fórmula:** `(Número de productos con ese motivo / Total de productos no conformes) × 100`
- **Datos:** Motivo
- **Base:** No Conformes

#### 3. Impacto en el Inventario por Ajustes
- **Fórmula:** `Impacto = Ajustes según Acción Tomada`
- **Datos:** Ajuste Inventario, Acción Tomada
- **Base:** No Conformes, Gestión de Inventario

#### 4. Tiempo Promedio de Resolución
- **Fórmula:** `(Fecha de resolución − Fecha de detección)`
- **Datos:** Fecha de detección, Fecha de resolución
- **Base:** No Conformes

### Futuros

#### 1. Predicción de No Conformidades
- **Fórmula:** Análisis de tendencias para predecir no conformidades.
- **Datos:** Historial de no conformidades
- **Base:** No Conformes

#### 2. Proyección de Ajustes de Inventario
- **Fórmula:** Estimación de ajustes futuros.
- **Datos:** Ajuste Inventario
- **Base:** No Conformes, Gestión de Inventario

#### 3. Proyección de Causas de No Conformidades
- **Fórmula:** Análisis predictivo para identificar causas más comunes.
- **Datos:** Motivo
- **Base:** No Conformes

---

## 3. Bitácora de Movimientos

### Históricos

#### 1. Total de Movimientos de Inventario
- **Fórmula:** `Cantidad Entrante + Cantidad Salida`
- **Datos:** Cantidad Entrante, Cantidad Salida
- **Base:** Bitácora de Movimientos

#### 2. Distribución de Movimientos por Tipo
- **Fórmula:** `(Cantidad Movida por Tipo de Movimiento) / Total de Movimientos × 100`
- **Datos:** Tipo de Movimiento
- **Base:** Bitácora de Movimientos

#### 3. Impacto de los Movimientos en el Inventario
- **Fórmula:** `Impacto en Inventario = Cantidad Entrante − Cantidad Salida`
- **Datos:** Cantidad Entrante, Cantidad Salida
- **Base:** Bitácora de Movimientos, Gestión de Inventario

#### 4. Tiempo Promedio de Movimiento
- **Fórmula:** `(Fecha de Salida − Fecha de Entrada) / Número de Movimientos`
- **Datos:** Fecha de Entrada, Fecha de Salida
- **Base:** Bitácora de Movimientos

### Futuros

#### 1. Predicción de Movimientos de Inventario
- **Fórmula:** Predicción basada en demanda y movimientos históricos.
- **Datos:** Cantidad Entrante, Cantidad Salida
- **Base:** Bitácora de Movimientos

#### 2. Proyección de Movimientos por Tipo
- **Fórmula:** Proyección de la distribución futura de tipos de movimiento.
- **Datos:** Tipo de Movimiento
- **Base:** Bitácora de Movimientos

#### 3. Predicción de Impacto en Inventario
- **Fórmula:** Estimación del impacto de los movimientos futuros.
- **Datos:** Cantidad Entrante, Cantidad Salida
- **Base:** Bitácora de Movimientos, Gestión de Inventario

---

## 4. Solicitudes de Material

### Históricos

#### 1. Cantidad Total Solicitada de Material
- **Fórmula:** `Suma de Cantidad Solicitada`
- **Datos:** Cantidad Solicitada
- **Base:** Solicitudes de Material

#### 2. Distribución de Solicitudes por Estado
- **Fórmula:** `(Número de solicitudes por estado / Total de solicitudes) × 100`
- **Datos:** Estado
- **Base:** Solicitudes de Material

#### 3. Costo Total de Solicitudes de Material
- **Fórmula:** `Costo Unitario × Cantidad Solicitada`
- **Datos:** Costo Unitario, Cantidad Solicitada
- **Base:** Solicitudes de Material, Proveedores y Productos

#### 4. Materiales con Baja Rotación
- **Fórmula:** `Número de productos solicitados con baja rotación`
- **Datos:** Demanda histórica 90/180 días, TDP
- **Base:** Solicitudes de Material, Catálogo de Productos

### Futuros

#### 1. Predicción de Solicitudes de Material
- **Fórmula:** Predicción basada en tendencias históricas.
- **Datos:** Cantidad Solicitada, Demanda histórica 90/180 días
- **Base:** Solicitudes de Material

#### 2. Proyección de Costos de Solicitudes de Material
- **Fórmula:** `Costo Unitario × Cantidad solicitada proyectada`
- **Datos:** Costo Unitario, Cantidad Solicitada
- **Base:** Solicitudes de Material

#### 3. Predicción de Materiales con Baja Rotación
- **Fórmula:** Predicción basada en análisis histórico de rotación.
- **Datos:** Demanda histórica 90/180 días, TDP
- **Base:** Solicitudes de Material, Catálogo de Productos

---

## 5. Entradas de Mercancía

### Históricos

#### 1. Desviación entre Cantidad Solicitada y Cantidad Llegada
- **Fórmula:** `Cantidad solicitada − Cantidad llegada`
- **Datos:** Cantidad solicitada, Cantidad llegada
- **Base:** Entradas de Mercancía

#### 2. Costo Total de Entradas de Mercancía
- **Fórmula:** `Costo Unitario × Cantidad llegada`
- **Datos:** Costo Unitario, Cantidad llegada
- **Base:** Entradas de Mercancía, Proveedores y Productos

#### 3. Porcentaje de Entrega Completa
- **Fórmula:** `(Cantidad llegada / Cantidad solicitada) × 100`
- **Datos:** Cantidad solicitada, Cantidad llegada
- **Base:** Entradas de Mercancía

#### 4. Análisis de Estado de Entrada de Mercancía
- **Fórmula:** Análisis del estado de pago y tipo de pago de las entradas.
- **Datos:** Estado, Status de pago, Tipo de pago
- **Base:** Entradas de Mercancía, Facturas Compras

### Futuros

#### 1. Proyección de Entradas de Mercancía
- **Fórmula:** Predicción basada en historial y demanda futura.
- **Datos:** Cantidad solicitada, Cantidad llegada
- **Base:** Entradas de Mercancía, Solicitudes de Material

#### 2. Proyección de Costo Total de Entradas
- **Fórmula:** `Costo Unitario proyectado × Cantidad solicitada proyectada`
- **Datos:** Costo Unitario, Cantidad solicitada
- **Base:** Entradas de Mercancía

---

## 6. Pedidos Incompletos

### Históricos

#### 1. Total de Pedidos Incompletos
- **Fórmula:** `Número de pedidos incompletos`
- **Datos:** Estado, Motivo de incompletitud
- **Base:** Pedidos Incompletos

#### 2. Distribución de Pedidos Incompletos por Motivo
- **Fórmula:** `(Número de pedidos por motivo / Total de pedidos incompletos) × 100`
- **Datos:** Motivo de Incompletitud
- **Base:** Pedidos Incompletos

---

## Bases de Datos Utilizadas
- Crecimiento de Inventario
- No Conformes
- Gestión de Inventario
- Bitácora de Movimientos
- Solicitudes de Material
- Catálogo de Productos
- Proveedores y Productos
- Entradas de Mercancía
- Facturas Compras
- Pedidos Incompletos
