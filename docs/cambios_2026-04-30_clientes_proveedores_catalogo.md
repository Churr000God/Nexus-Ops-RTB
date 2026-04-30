# Cambios 2026-04-30 — Clientes, Proveedores y Catálogo Cross

**Fecha:** 2026-04-30  
**Autor:** Kimi Code CLI  
**Rama:** `feature/mejoras-clientes-proveedores-catalogo`

---

## Resumen ejecutivo

Rediseño visual y funcional de las páginas maestro de **Clientes**, **Proveedores** y **Catálogo Cross-Proveedor**. Se alinean al patrón de diseño del resto de la aplicación (Productos, Cotizaciones) con scroll independiente, KPIs visuales, filtros mejorados y nuevas vistas.

---

## 1. Componentes reutilizables nuevos

### `frontend/src/components/common/ViewToggle.tsx`
- Toggle segmentado para cambiar entre vistas (tabla ↔ tarjetas / lista ↔ comparativa).
- Props genéricas: `options`, `active`, `onChange`.
- Usado en Clientes, Proveedores y Catálogo Cross.

### `frontend/src/components/common/EmptyState.tsx`
- Estado vacío reutilizable con icono, título y descripción.
- Reemplaza textos planos de "Sin resultados" en todas las páginas.

---

## 2. Página Clientes (`/clientes`)

### Antes
- Tabla simple con búsqueda y checkbox "Solo activos".
- Scroll global en el contenedor padre.
- Sin resumen visual ni filtros por tipo/localidad.

### Después
- **KPI Cards** superiores: Total, Activos, Inactivos, Empresas, Nacionales.
- **Filtros nuevos**: Tipo (Empresa/Persona) y Localidad (Nacional/Extranjero).
- **Toggle vista**: Tabla ↔ Grid de tarjetas.
- **Highlight de fila seleccionada** en la tabla (`selectedRowKey`).
- **Scroll independiente**: la tabla y el panel de detalle tienen scroll separado.
- **Toolbar fijo** fuera del DataTable para que no se desplace con el scroll.

### Backend
- `GET /api/clientes` ahora acepta `customer_type` y `locality` como query params.
- `list_customers()` aplica filtros SQLAlchemy por estos campos.

---

## 3. Página Proveedores (`/proveedores`)

### Antes
- Tabla con filtros básicos (tipo, localidad, solo activos).
- Scroll global en el contenedor padre.
- Sin KPIs ni vista alternativa.

### Después
- **KPI Cards** superiores: Total, Activos, Inactivos, Bienes, Servicios, Ocasionales.
- **Toggle vista**: Tabla ↔ Grid de tarjetas.
- **Highlight de fila seleccionada** en la tabla.
- **Scroll independiente** alineado al patrón de Productos.
- **Toolbar fijo** fuera del DataTable.

---

## 4. Página Catálogo Cross-Proveedor (`/proveedores/catalogo`)

### Antes
- Tabla única de 100 registros sin paginación.
- KPIs manuales simples.
- Solo lectura, sin comparación por producto.

### Después
- **Header profesional** con icono y toggle de vista.
- **KPI Cards** con diseño consistente: Relaciones totales, Proveedores activos, Vinculados, Sin vincular.
- **Toggle vista**: Lista ↔ Por Producto.
- **Vista "Por Producto"** (nueva):
  - Agrupa relaciones por SKU/producto maestro.
  - Cada producto muestra una mini tabla de proveedores con costo, lead time y preferido.
  - Destaca el **precio más bajo** con badge "Mejor".
  - Resalta el proveedor **preferido** con fondo ámbar.
  - Sección separada **"Sin vincular"** para items no asignados.
- **Paginación real**: 50 registros por página con controles Anterior/Siguiente.
- **Columna Disponible**: muestra `is_available` con badges.
- **Scroll independiente** alineado al resto de la aplicación.

---

## Archivos modificados

| Ruta | Cambio |
|------|--------|
| `frontend/src/components/common/ViewToggle.tsx` | Nuevo componente |
| `frontend/src/components/common/EmptyState.tsx` | Nuevo componente |
| `frontend/src/pages/Clientes.tsx` | Rediseño completo |
| `frontend/src/pages/ProveedoresMaestro.tsx` | Rediseño completo |
| `frontend/src/pages/proveedores/CatalogoPage.tsx` | Rediseño completo |
| `frontend/src/services/clientesProveedoresService.ts` | Params `customer_type` y `locality` en `listCustomers` |
| `backend/app/routers/clientes_proveedores.py` | Query params `customer_type` y `locality` en `list_clientes` |
| `backend/app/services/clientes_proveedores_service.py` | Filtros `customer_type` y `locality` en `list_customers` |
| `backend/app/schemas/clientes_proveedores_schema.py` | Schemas `CatalogoItemRead` y `CatalogoListResponse` |
| `frontend/src/types/clientesProveedores.ts` | Tipos `CatalogoItem` y `CatalogoListResponse` |

---

## Verificación

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` (frontend) | ✅ Sin errores |
| `npm run build` (frontend) | ✅ Éxito |
| `ast.parse` (backend) | ✅ Sin errores de sintaxis |

---

## Notas técnicas

- El scroll independiente se logra envolviendo la tabla/grid en un contenedor `flex-1 min-w-0 overflow-hidden` y usando `fillHeight` en el `DataTable`.
- El panel de detalle tiene su propio `overflow-y-auto` interno, evitando interferencia con el scroll de la lista.
- La vista comparativa por producto se calcula 100% en frontend (`useMemo`) agrupando por `product_sku`; no requiere cambios de API.
- La paginación usa `offset/limit` ya soportado por el backend (`listCatalogo`).
