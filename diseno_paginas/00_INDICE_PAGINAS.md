# Nexus Ops RTB — Índice de Diseño de Páginas

**Fecha de creación:** 2026-04-17
**Propósito:** Documentos de diseño que especifican la arquitectura, contenido, gráficos, filtros y funcionalidades de cada página de la plataforma web Nexus Ops RTB. Cada archivo sirve como especificación funcional para el desarrollo.

---

## Mapa de Navegación

```
┌───────────────────────────────────────────────────────────┐
│                  DASHBOARD GENERAL (/)                    │
│  Resumen ejecutivo · KPIs globales · Estado del sistema   │
└────────────────────────┬──────────────────────────────────┘
                         │
    ┌────────┬───────────┼───────────┬──────────┬──────────┐
    ▼        ▼           ▼           ▼          ▼          ▼
 Ventas  Inventarios Proveedores  Gastos   Admin.    Cotizaciones
(/ventas)(/inv)     (/prov)      (/gastos)(/admin) (/cotizaciones)
```

> Las páginas `Admin.` y `Cotizaciones` son **propuestas de expansión** descritas en [07_sugerencias_mejoras.md](07_sugerencias_mejoras.md). El alcance base contempla solo las 5 primeras.

---

## Archivos de Diseño

| # | Archivo | Página | Estado |
|---|---------|--------|--------|
| 00 | [00_INDICE_PAGINAS.md](00_INDICE_PAGINAS.md) | Índice maestro de diseño | Activo |
| 01 | [01_dashboard_general.md](01_dashboard_general.md) | Página Principal / Dashboard General | Por diseñar |
| 02 | [02_pagina_ventas.md](02_pagina_ventas.md) | Página de Ventas | Por diseñar |
| 03 | [03_pagina_inventarios.md](03_pagina_inventarios.md) | Página de Inventarios | Por diseñar |
| 04 | [04_pagina_proveedores.md](04_pagina_proveedores.md) | Página de Proveedores | Por diseñar |
| 05 | [05_pagina_gastos.md](05_pagina_gastos.md) | Página de Gastos | Por diseñar |
| 06 | [06_funcionalidades_globales.md](06_funcionalidades_globales.md) | Filtros, túnel, reportes, correo | Por diseñar |
| 07 | [07_sugerencias_mejoras.md](07_sugerencias_mejoras.md) | Propuestas de mejora y cobertura | Por diseñar |

---

## Relación entre Contexto y Diseño

- Carpeta **contexto/** → define QUÉ métricas se miden (fuente de verdad del negocio).
- Carpeta **diseno_paginas/** → define DÓNDE se muestra cada métrica en la web y CÓMO.

En [07_sugerencias_mejoras.md](07_sugerencias_mejoras.md) se incluye la matriz de trazabilidad completa: cada métrica del contexto se asigna a la página que la renderiza.

---

## Convenciones de Diseño

- **Sistema base:** Dashboard SPA con navegación lateral.
- **Tipografía de datos:** Todos los montos en MXN; formato numérico con separador de miles y dos decimales.
- **Paleta de gráficas:**
  - Azul primario para datos actuales / reales.
  - Naranja para proyectados / objetivo.
  - Verde para estados positivos / completados.
  - Rojo para alertas / errores / retrasos.
  - Gris para referencias históricas.
- **Interactividad:** Todas las gráficas permiten `click-to-drill` hacia el detalle; tooltips con valores absolutos y porcentuales.
- **Responsive:** Breakpoints desktop (≥1280px) y tablet (≥768px); mobile opcional en fase 2.
- **Accesibilidad:** Contraste AA mínimo; labels en español; iconografía con texto alternativo.

---

## Componentes Comunes en Todas las Páginas

Cada página debe incluir, como mínimo:
1. **Encabezado** con título de la página, fecha de última actualización y estado de automatización.
2. **Barra de filtros** avanzados (fecha, categoría, cliente/proveedor/producto).
3. **Botón de actualización manual** que dispara flujo n8n.
4. **Botón de generación de reporte** (DOCX / PDF).
5. **Botón de descarga de CSV** con los datos filtrados.
6. **Botón de envío por correo** del reporte generado.
7. **Indicador de estado del túnel Cloudflare** (activo / inactivo).
