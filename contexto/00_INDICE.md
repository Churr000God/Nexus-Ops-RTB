# Nexus Ops RTB — Índice Maestro de Contexto

**Fecha de creación:** 2026-04-17
**Propietario:** Diego (dhguilleng@gmail.com)
**Propósito:** Documentos de referencia que definen el alcance, métricas y bases de datos del proyecto Nexus Ops RTB. Estos archivos sirven como contexto persistente para todas las sesiones de trabajo.

---

## Objetivo del Proyecto

Crear una página web interactiva que muestre dashboards de diferentes áreas, actualice datos dinámicamente, y permita generar reportes en formatos como DOCX y CSV. Acceso restringido vía túnel de Cloudflare o red WiFi local. Incluye filtros avanzados, estadísticas, gráficas interactivas, automatización de actualización de datos vía n8n y generación de reportes con envío por correo.

---

## Estructura de Archivos de Contexto

| # | Archivo | Contenido |
|---|---------|-----------|
| 00 | [00_INDICE.md](00_INDICE.md) | Este archivo — índice maestro |
| 01 | [01_ventas.md](01_ventas.md) | Métricas históricas y futuras del **Área de Ventas** |
| 02 | [02_almacen.md](02_almacen.md) | Métricas históricas y futuras del **Área de Almacén** |
| 03 | [03_finanzas.md](03_finanzas.md) | Métricas históricas y futuras del **Área de Finanzas** |
| 04 | [04_administracion.md](04_administracion.md) | Métricas históricas y futuras del **Área de Administración** |
| 05 | [05_bases_de_datos.md](05_bases_de_datos.md) | Catálogo unificado de bases de datos referenciadas |

---

## Áreas Cubiertas

### 1. Ventas
Análisis retrospectivo de ventas, tiempos y rentabilidad; proyecciones de demanda, facturación y comportamiento del cliente; análisis de clientes locales vs. foráneos; ventas cerradas mes a mes.

### 2. Almacén
Crecimiento de inventario, productos no conformes, bitácora de movimientos, solicitudes de material, entradas de mercancía y pedidos incompletos.

### 3. Finanzas
Ventas y cotizaciones, cotizaciones canceladas, solicitudes a proveedores, gastos operativos RTB y facturas de compras.

### 4. Administración
Tiempos de procesamiento por etapa de pedido, retrasos en el flujo de trabajo y frecuencia de activación de automatizaciones.

---

## Componentes Funcionales del Sistema (resumen)

- **Dashboard general** con gráficas de barras, líneas, circulares y barras apiladas.
- **Páginas específicas** por área (Ventas, Inventarios, Proveedores, Gastos).
- **Botón de actualización** integrado con flujos de n8n para refrescar archivos CSV.
- **Estado de automatización** visible (completado / en proceso / error).
- **Generación de reportes** en DOCX/PDF con envío por correo.
- **Filtros avanzados** por fecha y categoría.
- **Túnel Cloudflare** con estado visible y botón para copiar enlace.
- **Modelos predictivos** para ventas, márgenes, demanda y empacado.

---

## Reglas Generales del Sistema

- Los datos se actualizan automáticamente cuando los CSV se refrescan o n8n ejecuta los flujos.
- Cada reporte incluye fecha y periodo analizado.
- Los errores de automatización se registran y notifican al administrador.
- Acceso restringido por túnel Cloudflare o red WiFi local.
- Consultas a base de datos optimizadas para respuesta rápida.
