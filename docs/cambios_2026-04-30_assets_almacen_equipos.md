# Almacén & Equipos — Bloques 1–7 (2026-04-30)

Implementación completa del módulo de activos físicos en `EquiposPage` + nuevo módulo de conteos en `ConteosPage`. Siete bloques incrementales construidos sobre la base existente (migraciones 0019–0021).

---

## Bloque 1 — Búsqueda y filtros de activos

**Cambios mínimos:** parámetro `search` añadido al endpoint `GET /api/assets` y al servicio frontend `listAssets`. La búsqueda hace `OR ILIKE` sobre `asset_code` y `name`.

Backend:
- `list_assets(search?)` — filtra con `or_(Asset.asset_code.ilike(), Asset.name.ilike())`
- Router: `search: str | None = Query(default=None)`

Frontend:
- `assetsService.listAssets(token, { search? })` — pasa `search` a `withQuery()`
- `AssetFormModal`: campo de búsqueda para activo padre con debounce 300 ms; muestra dropdown con resultados; chip para activo seleccionado con X para limpiar

---

## Bloque 2 — Asignación de activos

**Migración:** ninguna nueva (tabla `asset_assignment_history` ya existía desde 0020).

### Flujo
1. `POST /api/assets/{id}/assign` con `{ user_id?, location?, notes? }`
2. Service inserta `AssetAssignmentHistory` + actualiza `asset.assigned_user_id` + `asset.location`
3. `user_id = null` = desasignar (liberar activo)
4. Historial: `GET /api/assets/{id}/assignments` — JOINs con `users` para email y nombre

### Sentinel frontend
El select de usuarios usa `__none__` como value cuando no hay usuario seleccionado; se convierte a `null` antes del POST.

### Schemas nuevos
`AssignAssetPayload`, `AssetAssignmentRead`

---

## Bloque 3 — Baja / Retiro formal

**Migración 0029** (`20260430_0029_asset_retirement_fields.py`):
```sql
ALTER TABLE assets ADD COLUMN retired_at         TIMESTAMPTZ NULL;
ALTER TABLE assets ADD COLUMN retirement_reason  TEXT        NULL;
ALTER TABLE assets ADD COLUMN salvage_value      NUMERIC(14,4) NULL;
ALTER TABLE assets ADD COLUMN retired_by         UUID REFERENCES users(id) ON DELETE SET NULL;
```

### Flujo
1. Botón `AlertTriangle` en el header de `AssetDetailPanel` (visible solo si status ∉ RETIRED/DISMANTLED)
2. Abre `RetireAssetModal` (motivo + valor residual)
3. `POST /api/assets/{id}/retire` con `RetireAssetPayload`
4. Service valida status → 400 si ya retirado
5. Actualiza: `status=RETIRED`, `retired_at=now()`, `retirement_reason`, `salvage_value`, `retired_by`
6. Panel se cierra y la lista se recarga

### Visibilidad
La tarjeta de "Baja formal" aparece en la tab Info solo cuando `asset.retired_at != null`.

---

## Bloque 4 — Conteo Físico / Reconciliación

**Migración 0030** (`20260430_0030_physical_counts.py`):
```sql
CREATE TABLE physical_counts (
    id UUID PK, count_date DATE, location_filter VARCHAR NULL,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK IN ('DRAFT','CONFIRMED','CANCELLED'),
    notes TEXT, created_by UUID FK users, created_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ NULL, confirmed_by UUID FK users NULL
);

CREATE TABLE physical_count_lines (
    id UUID PK, count_id UUID FK physical_counts CASCADE,
    asset_id UUID FK assets,
    asset_code VARCHAR (snapshot), asset_name VARCHAR (snapshot),
    expected_location VARCHAR NULL (snapshot),
    scanned_location VARCHAR NULL, found BOOLEAN NULL, notes TEXT NULL
);
```

### Flujo de conteo
1. `POST /api/assets/counts` — crea conteo DRAFT; snapshot de todos los activos activos (no RETIRED/DISMANTLED) que coincidan con el filtro de ubicación
2. Operador marca cada línea: `PATCH /api/assets/counts/{id}/lines/{lid}` con `{ found: true/false, scanned_location? }`
3. `POST /api/assets/counts/{id}/confirm` — solo desde DRAFT; cierra el conteo

### Estadísticas (computadas en Python)
```
total_lines  = len(lines)
found_count  = sum(l.found is True)
not_found    = sum(l.found is False)
pending      = total - found - not_found  (found is NULL)
```

### Frontend — ConteosPage
- Vista lista: KPI cards (Total / DRAFT / CONFIRMED) + DataTable de conteos
- Vista detalle: breadcrumb + stats + botón Confirmar (solo DRAFT) + DataTable de líneas con toggle ✓/✗ inline
- Ruta: `/activos/conteos` — registrada en `routes.tsx` y `Sidebar.tsx`

---

## Bloque 5 — Jerarquía parent_asset_id

**Migración 0031** (`20260430_0031_asset_parent_hierarchy.py`):
```sql
ALTER TABLE assets ADD COLUMN parent_asset_id UUID NULL
    REFERENCES assets(id) ON DELETE SET NULL;
CREATE INDEX ix_assets_parent_asset_id ON assets(parent_asset_id);
```

### ORM (SQLAlchemy self-referential)
```python
children: Mapped[list[Asset]] = relationship(
    "Asset", foreign_keys="Asset.parent_asset_id", back_populates="parent", lazy="select"
)
parent: Mapped[Asset | None] = relationship(
    "Asset", foreign_keys="Asset.parent_asset_id", back_populates="children",
    remote_side="Asset.id", lazy="select"
)
```

### Frontend
- `AssetFormModal`: campo de búsqueda de activo padre (debounce 300 ms, `listAssets({ search, limit: 8 })`)
- Tab "Sub-activos (N)" en `AssetDetailPanel`: llama `GET /api/assets/{id}/children`
- Tab Info: muestra activo padre (nombre + código + ícono GitBranch) vía `getAsset(parent_asset_id)` lazy

---

## Bloque 6 — Órdenes de Mantenimiento

**Migración 0032** (`20260430_0032_asset_work_orders.py`):
```sql
CREATE TABLE asset_work_orders (
    id UUID PK, asset_id UUID FK assets CASCADE,
    title VARCHAR, description TEXT NULL,
    work_type VARCHAR(20) CHECK IN ('PREVENTIVE','CORRECTIVE','INSPECTION','UPGRADE'),
    priority  VARCHAR(20) CHECK IN ('LOW','MEDIUM','HIGH','URGENT') DEFAULT 'MEDIUM',
    status    VARCHAR(20) CHECK IN ('OPEN','IN_PROGRESS','DONE','CANCELLED') DEFAULT 'OPEN',
    assigned_to UUID FK users NULL,
    scheduled_date DATE NULL, started_at TIMESTAMPTZ NULL, completed_at TIMESTAMPTZ NULL,
    cost NUMERIC(14,4) NULL, notes TEXT NULL,
    created_by UUID FK users NULL, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
```

### Endpoints
| Method | Path | Descripción |
|---|---|---|
| POST | /api/assets/{id}/work-orders | Crear orden (status=OPEN, 201) |
| GET | /api/assets/{id}/work-orders | Listar — ORDER BY status priority (OPEN→IN_PROGRESS→rest), luego created_at DESC |
| PATCH | /api/assets/{id}/work-orders/{wo_id} | Actualizar (status, fechas, costo, notas) |

El campo `assigned_to_email` se obtiene con un JOIN SQL en `_wo_to_read()`.

### Frontend
- Tab "Mant. (N)" en `AssetDetailPanel`
- Botón "Nueva Orden" abre `WorkOrderFormModal` en modo creación
- Click en fila abre modal en modo edición (campos adicionales: status, started_at, completed_at)
- Priority badge: U=rojo, H=naranja, M=ámbar, L=slate

---

## Bloque 7 — Depreciación (Línea Recta)

**Migración 0033** (`20260430_0033_asset_depreciation_config.py`):
```sql
CREATE TABLE asset_depreciation_config (
    id UUID PK, asset_id UUID FK assets CASCADE UNIQUE,
    method VARCHAR(20) CHECK IN ('STRAIGHT_LINE') DEFAULT 'STRAIGHT_LINE',
    useful_life_years INTEGER CHECK > 0,
    residual_value NUMERIC(14,4) CHECK >= 0 DEFAULT 0,
    start_date DATE,
    created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
```

### Algoritmo (Python, no PL/pgSQL)

```python
annual = (purchase_cost - residual_value) / useful_life_years

for year in range(1, life + 1):
    p_start = _add_years(start_date, year - 1)
    p_end   = _add_years(start_date, year) - timedelta(days=1)
    accumulated = annual * year
    book_value  = max(residual_value, purchase_cost - accumulated)
    is_current  = p_start <= today <= p_end
```

`_add_years(d, n)` — módulo-level helper que reemplaza `dateutil.relativedelta` (no instalado); maneja bisiesto con `try/except ValueError → day=28`.

### Respuesta `DepreciationScheduleRead`
```python
config: DepreciationConfigRead | None
asset_cost: float | None
current_book_value: float | None          # valor en libros del período actual
accumulated_depreciation: float | None   # acumulado al período actual
percent_depreciated: float | None        # acumulado / (costo - residual) * 100
periods: list[DepreciationPeriodRead]    # tabla completa año a año
```

Si el activo no tiene `purchase_cost` registrado, retorna un schedule vacío sin error (el frontend muestra una advertencia).

### Frontend — DepreciationTab
- Autónomo: maneja su propio fetch/state sin elevar al panel padre
- 4 KPI cards: costo original, valor en libros, dep. acumulada, % depreciado
- Formulario inline de configuración: vida útil, valor residual, fecha inicio
- Tabla año-a-año: fila del período actual resaltada con `bg-blue-500/10`

---

## Archivos modificados / creados

### Backend
| Archivo | Tipo |
|---|---|
| `alembic/versions/20260430_0029_asset_retirement_fields.py` | Nuevo |
| `alembic/versions/20260430_0030_physical_counts.py` | Nuevo |
| `alembic/versions/20260430_0031_asset_parent_hierarchy.py` | Nuevo |
| `alembic/versions/20260430_0032_asset_work_orders.py` | Nuevo |
| `alembic/versions/20260430_0033_asset_depreciation_config.py` | Nuevo |
| `app/models/assets_models.py` | Modificado |
| `app/schemas/assets_schema.py` | Modificado |
| `app/services/assets_service.py` | Modificado |
| `app/routers/assets.py` | Modificado |

### Frontend
| Archivo | Tipo |
|---|---|
| `src/types/assets.ts` | Modificado |
| `src/services/assetsService.ts` | Modificado |
| `src/components/assets/AssetDetailPanel.tsx` | Modificado |
| `src/components/assets/AssetFormModal.tsx` | Modificado |
| `src/components/assets/AssignAssetModal.tsx` | Nuevo |
| `src/components/assets/RetireAssetModal.tsx` | Nuevo |
| `src/components/assets/WorkOrderFormModal.tsx` | Nuevo |
| `src/components/assets/CreateCountModal.tsx` | Nuevo |
| `src/components/assets/DepreciationTab.tsx` | Nuevo |
| `src/pages/ConteosPage.tsx` | Nuevo |
| `src/routes.tsx` | Modificado |
| `src/components/layout/Sidebar.tsx` | Modificado |

### Documentación
| Archivo | Tipo |
|---|---|
| `estructura_proyecto/15_modulo_inventario_almacen.md` | Reescritura completa |
| `estructura_proyecto/11_bitacora_cambios.md` | Entrada añadida |
| `docs/cambios_2026-04-30_assets_almacen_equipos.md` | Nuevo (este archivo) |

---

## Errores encontrados y soluciones

| Error | Causa | Solución |
|---|---|---|
| `ModuleNotFoundError: dateutil` | `python-dateutil` no instalado en el container | Reemplazado por helper `_add_years()` con `date.replace(year=...)` |
| `Cannot find module '@/store/authStore'` | Path incorrecto (sin `s` al final) | Corregido a `@/stores/authStore` |
| `Parameter 's' implicitly has 'any'` | TypeScript no infería el tipo del selector de Zustand | Tipo inline: `(s: { accessToken: string | null }) => s.accessToken` |
| Múltiples cabezas Alembic | Dos branches: `20260429_0027` (totp) y assets chain | Siempre `alembic upgrade <revision_específica>` |
| `Duplicate useApi import` | Import accidental al editar AssetDetailPanel | Eliminado el import duplicado |
