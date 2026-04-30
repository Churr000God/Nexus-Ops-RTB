# Catálogo de Productos — Mejoras UI/UX (2026-04-30)

## Contexto

Se realizó una iteración completa de mejoras visuales y de usabilidad en la página de **Catálogo de Productos** (`/catalogos/productos`), abarcando la vista de listado (tabla/grid), los formularios de creación/edición, el panel de información de producto y la interacción entre tabla y panel lateral.

Este trabajo es exclusivamente **frontend** — no hay cambios de BD ni de backend.

---

## Commits

| Commit | Mensaje | Tipo |
|---|---|---|
| `53d3818` | `feat(frontend): mejora visual del catalogo de productos` | Feature |
| `fb4509a` | `feat(frontend): mejora visual de formularios y panel de producto` | Feature |
| `be67be9` | `fix(frontend): overlay modal al scroll y filtro is_saleable en catalogo` | Fix |
| `95e268d` | `fix(frontend): responsive en tarjetas de productos del catalogo` | Fix |
| `c9eeaa0` | `fix(frontend): tabla y panel de detalle con igual altura en catalogo` | Fix |
| `af3ee32` | `fix(frontend): scroll separado en tabla y panel de detalle del catalogo` | Fix |

---

## 1. Vista de Listado — Tabla y Grid

### Toggle vista Tabla / Grid

- Nuevo toggle con iconos (`List` / `LayoutGrid`) en la toolbar principal.
- La vista **Grid** muestra tarjetas de producto con imagen, nombre, SKU, badges de categoría/marca, precio y demanda.

### Grid responsive

| Breakpoint | Columnas | Gap |
|---|---|---|
| Default (mobile) | 2 | `gap-3` |
| `sm` | 2 | `gap-4` |
| `md` | 3 | `gap-4` |
| `lg` | 4 | `gap-4` |
| `xl` | 5 | `gap-4` |

### Badges de estado (`StatusChip`)

Cada estado de producto ahora tiene un color distintivo:

| Estado | Color |
|---|---|
| Activo | Verde (`emerald`) |
| Agotado | Ámbar (`amber`) |
| Próximamente | Azul cielo (`sky`) |
| Pendiente | Naranja (`orange`) |
| Dado de Baja / Descontinuado / Inactivo | Rojo (`red`) |

### Filtros enriquecidos

Nuevos filtros en la toolbar:
- **Búsqueda:** por nombre, SKU o código interno (con debounce 350ms)
- **Status:** toggle Activos / Todos
- **Categoría:** dropdown con jerarquía plana
- **Marca:** dropdown
- **Tipo de inventario:** Todos / Vendibles / Internos (filtrado frontend por `is_saleable`)

Contador de filtros activos visible en el header.

---

## 2. Tarjetas de Producto (Grid View)

### Badges apilados

Los badges `StatusChip` (estado) y `SaleableChip` (tipo de inventario) se apilan **verticalmente** (`flex-col`) en la esquina superior derecha de la imagen, evitando superposición en tarjetas estrechas.

### Imagen responsive

- Altura adaptativa: `h-32 sm:h-36 md:h-40`
- Placeholder con icono `Package` escalable: `h-8 w-8 sm:h-10 sm:w-10`

### Contenido adaptativo

- Padding: `p-3 sm:p-4`
- Espaciado: `space-y-2.5 sm:space-y-3`
- Botones de acción: `p-1 sm:p-1.5`

---

## 3. Formulario de Creación / Edición (`ProductFormModal`)

### Overlay robusto al scroll

El modal se reestructuró con capas separadas:
- **Capa fija:** `fixed inset-0 z-50` (contenedor padre inmóvil)
- **Overlay:** `absolute inset-0 bg-black/60 backdrop-blur-sm` (cubre todo el viewport)
- **Scroll container:** `h-full overflow-y-auto` (scroll del contenido sin mover el fondo oscuro)

### Secciones organizadas en cards

Cada bloque del formulario está agrupado en un `SectionCard` con fondo sutil, borde y título con icono:

| Sección | Icono | Campos |
|---|---|---|
| Identificación | `Tag` | SKU, Código interno, Nombre, Descripción |
| Clasificación | `FolderOpen` | Tipo de inventario, Categoría, Marca, Status, Tipo de venta, Tamaño paquete, Ubicación |
| Precios y costos | `Banknote` | Precio unitario, Costo refacciones, Costo Ariba |
| Imagen y documentos | `ImageIcon` | URL de imagen (con preview 128×128 y botón limpiar), URL ficha técnica |
| Atributos adicionales | `Boxes` | Producto configurable, Producto ensamblado |

### Inputs mejorados

- Precios con prefijo `$`
- Ubicación con icono `MapPin`
- Ficha técnica con icono `FileText`
- Selects nativos con hover suave
- Switches animados para booleanos

---

## 4. Panel de Información del Producto (`ProductDetailPanel`)

### Header con imagen prominente

- Imagen del producto a 192px de alto con placeholder visual cuando no hay imagen.
- Badge de estado flotante (`StatusChip`) en la esquina superior.

### Badges con iconos

| Badge | Icono |
|---|---|
| Categoría | `FolderOpen` |
| Marca | `Building2` |
| Tipo de venta | `Tag` |

### Secciones agrupadas

- **Información general:** Categoría, Marca, Tipo venta, Ubicación
- **Precios y costos:** Precio unitario, Precio sugerido, Costo refacciones, Costo Ariba
- **Demanda e inventario:** Demanda 90/180 días, Total venta acumulada, Última salida

### Links de documentos

Botones con borde y fondo sutil para "Ver imagen" y "Ficha técnica".

---

## 5. Tabla y Panel Lateral — Layout Unificado

### Problema original

Al desplegar el panel de detalle:
- La tabla perdía scroll horizontal/vertical.
- El panel se sobreponía al ancho de la tabla.
- No había separación de scroll entre ambos elementos.

### Solución implementada

**Nueva prop `fillHeight` en `DataTable`:**

```tsx
<DataTable
  fillHeight={!!selectedProduct}
  maxHeight={selectedProduct ? undefined : "calc(100vh - 380px)"}
/>
```

Cuando `fillHeight` es `true`:
- Root del DataTable: `h-full flex flex-col`
- Scroll container: `flex-1 overflow-y-auto`
- El scroll horizontal y vertical funcionan independientemente.

**Layout del catálogo:**

```
┌─────────────────────────────────┬──────────────┐
│  flex-1 min-w-0 h-full          │ w-[300px]    │
│  overflow-hidden                │ shrink-0     │
│                                 │ h-full       │
│  ┌─────────────────────────┐    │ overflow-h   │
│  │ DataTable (fillHeight)  │    │              │
│  │ ┌─────────────────────┐ │    │ ┌──────────┐ │
│  │ │ Scroll H + V propio │ │    │ │ Panel    │ │
│  │ └─────────────────────┘ │    │ │ scroll   │ │
│  └─────────────────────────┘    │ │ vertical │ │
│                                 │ └──────────┘ │
└─────────────────────────────────┴──────────────┘
```

- Ambos contenedores comparten la misma altura del padre flex (`h-full`).
- Cada uno tiene su propio scroll: la tabla horizontal+vertical, el panel solo vertical.
- Eliminado `max-w-[calc(100%-320px)]` que causaba desbordamiento.

---

## 6. Modal de Confirmación (`DeleteConfirmModal`)

- Icono `Trash2` en círculo rojo centrado.
- Texto centrado con mejor jerarquía visual.
- Overlay con `backdrop-blur-sm`.

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/pages/catalogos/ProductosCatalogoPage.tsx` | Refactor completo: vista grid, filtros, formulario, panel de detalle, layout responsive, scroll separado |
| `frontend/src/components/common/DataTable.tsx` | Nueva prop `fillHeight?: boolean` para ocupar altura completa del contenedor padre |

---

## Archivos de sesión

| Archivo | Descripción |
|---|---|
| `.ai-agents/learning/sessions/2026-04-30_mejora-ui-catalogo-productos.md` | Sesión 20 — Vista grid, filtros, badges |
| `.ai-agents/learning/sessions/2026-04-30_mejora-formularios-y-panel-producto.md` | Sesión 21 — Formularios, panel, responsive, scroll, layout |
| `.ai-agents/learning/SESSION_LOG.md` | Índice actualizado (21 sesiones) |

---

## Próximos pasos sugeridos

| # | Tarea | Área |
|---|---|---|
| 1 | Paginación server-side cuando el catálogo supere 500 productos | Backend + Frontend |
| 2 | Drag-and-drop de imágenes en el formulario de producto | Frontend |
| 3 | Validación de formulario con `zod` + `react-hook-form` | Frontend |
| 4 | Exportar catálogo a CSV/Excel | Frontend |
