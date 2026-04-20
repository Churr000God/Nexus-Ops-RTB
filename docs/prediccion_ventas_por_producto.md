# Predicción de Ventas por Producto

## ¿Qué muestra esta gráfica?

La gráfica **"Predicción de Ventas por Producto"** estima cuántas unidades se venderán de cada producto en el próximo mes, basándose en el historial reciente. No es una proyección financiera sino una señal de demanda esperada útil para planeación de inventario y compras.

---

## Cómo se calculan los datos

### Fuentes de información

| Tabla | Rol |
|---|---|
| `cotizacion_items` | Unidades solicitadas o empacadas por línea de cotización |
| `cotizaciones` | Fecha de aprobación o creación de la cotización |
| `ventas` | Fecha real de venta (`sold_on`) cuando existe |
| `productos` | Nombre comercial del producto |

### Lógica paso a paso

**Paso 1 — Agrupar unidades vendidas por producto y mes**

Para cada producto se suma `COALESCE(qty_packed, qty_requested, 0)` en cada mes calendario. La fecha del mes se toma de la primera fuente disponible en este orden: `ventas.sold_on` → `cotizaciones.approved_on` → `cotizaciones.created_on`.

Se excluyen registros con estado cancelado, rechazado o con variantes de esas palabras en español e inglés (`cancelad`, `cancelled`, `rechazad`).

```
mes_1: producto A → 300 unidades
mes_2: producto A → 270 unidades
mes_3: producto A → 360 unidades
```

**Paso 2 — Numerar los meses más recientes (ROW_NUMBER)**

Usando una ventana `ROW_NUMBER() OVER (PARTITION BY producto ORDER BY mes DESC)` se asigna el número 1 al mes más reciente, 2 al anterior, y así sucesivamente.

```
mes_3 (más reciente) → rn = 1
mes_2               → rn = 2
mes_1               → rn = 3
```

**Paso 3 — Promedio móvil de los últimos N meses**

Se filtra `WHERE rn <= months_window` (por defecto `months_window = 3`) y se calcula el promedio simple:

```
predicted_units = AVG(300, 270, 360) = 310 unidades
```

Este número representa la **demanda mensual esperada** para ese producto.

**Paso 4 — Ordenar y limitar**

Los productos se ordenan de mayor a menor `predicted_units` y se devuelven los primeros N (por defecto 15).

---

## Ejemplo completo

Supón que tienes este historial para el producto **SV-869 (Aireador HELVEX)**:

| Mes | Unidades vendidas |
|---|---|
| Enero 2026 | 280 |
| Febrero 2026 | 320 |
| Marzo 2026 | 330 |
| Abril 2026 (incompleto) | — |

Con `months_window = 3` el sistema toma los 3 meses más recientes completos (enero, febrero, marzo) y calcula:

```
predicted_units = (280 + 320 + 330) / 3 = 310 unidades
```

Esto significa que, si el comportamiento se mantiene, **se esperan ~310 unidades vendidas de SV-869 el próximo mes**.

---

## Cómo interpretar la gráfica

- **Barra más larga** → mayor demanda histórica promedio → priorizar en inventario.
- **Barra corta** → producto con menor rotación reciente.
- El número junto a cada barra está expresado en **unidades por mes (u/mes)**.
- La lista de la derecha muestra el ranking con SKU visible para cruzar rápidamente con el sistema de compras.

### Limitaciones importantes

| Situación | Efecto |
|---|---|
| Producto sin ventas en los últimos N meses | No aparece en la gráfica |
| Ventas muy estacionales | El promedio puede subestimar picos o valles |
| Cotizaciones sin fecha de venta ni aprobación | Se usa `created_on`, lo que puede adelantar artificialmente el mes |
| Filtro de fechas activo en el dashboard | Solo se consideran registros dentro del rango seleccionado |

---

## Parámetros configurables (API)

| Parámetro | Default | Descripción |
|---|---|---|
| `months_window` | `3` | Cuántos meses hacia atrás se promedian |
| `limit` | `15` | Máximo de productos a devolver |
| `start_date` / `end_date` | `null` | Filtro de fechas sobre el historial base |

Endpoint: `GET /api/ventas/product-forecast`
