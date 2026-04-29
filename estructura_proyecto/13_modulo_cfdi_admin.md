# Módulo 13 — Administración CFDI (Fiscal + Series)

Páginas de configuración fiscal dentro de la sección Admin. Rutas: `/admin/fiscal` y `/admin/series`.

---

## 1. Permisos RBAC

| Permiso | Operación |
|---------|-----------|
| `cfdi.view` | Leer configuración e issuer config |
| `cfdi.config.manage` | Escribir (crear/editar) issuer config y series |

Ambas páginas leen con `cfdi.view` y bloquean escritura si el usuario no tiene `cfdi.config.manage` (inputs disabled, botones ocultos).

---

## 2. Configuración del Emisor (`/admin/fiscal`)

### Propósito
Almacenar los datos fiscales del emisor SAT (RFC, razón social, régimen, CP) y las credenciales del PAC (proveedor de certificación). Se guarda en `cfdi_issuer_config`. Cada `POST` desactiva la fila anterior e inserta una nueva (`is_active = TRUE`) para mantener trazabilidad histórica.

### Componentes

#### `StatusBanner`
Aparece cuando ya existe una configuración activa. Muestra:
- RFC y Razón Social
- Última actualización (`updated_at`)
- Badge de entorno: `SANDBOX` (amber) / `PRODUCTION` (emerald)

#### Sección — Datos del Emisor
| Campo | Tipo | Notas |
|-------|------|-------|
| RFC | `text` | Obligatorio |
| Razón Social | `text` | Obligatorio |
| Régimen Fiscal SAT | `ThemedSelect` | `tax_regime_id` — catálogo parcial incluido en el select |
| Código Postal | `text` | Obligatorio |

#### Sección — CSD (Certificado de Sello Digital)
| Campo | Tipo | Notas |
|-------|------|-------|
| No. Certificado | `text` | Opcional |
| Válido desde / hasta | `date` | Opcional, sin edición de folio |

#### Sección — PAC (Proveedor de Certificación)
| Campo | Tipo | Notas |
|-------|------|-------|
| Proveedor | `ThemedSelect` | DIVERZA / EDICOM / FACTURAMA / STUB |
| Entorno | `ThemedSelect` | SANDBOX / PRODUCTION |
| Vigencia desde / hasta | `date` | Opcional |

#### `ThemedSelect`
`<select>` nativo con clases de tema (`border-border bg-background text-foreground`) en lugar de clases dark‑mode. Necesario porque el app usa tema **light** (`--background: 220 18% 97%`).

### Endpoints backend
| Método | Ruta | Guard |
|--------|------|-------|
| `GET` | `/api/cfdi/issuer-config` | `cfdi.view` |
| `POST` | `/api/cfdi/issuer-config` | `cfdi.config.manage` |

### Archivos
| Archivo | Descripción |
|---------|-------------|
| `frontend/src/pages/admin/FiscalPage.tsx` | Página completa con `StatusBanner`, 3 tarjetas de formulario |
| `backend/app/schemas/cfdi_schemas.py` | `CfdiIssuerConfigIn` / `CfdiIssuerConfigOut` |
| `backend/app/services/cfdi_service.py` | `get_active_issuer_config`, `save_issuer_config` |
| `backend/app/routers/cfdi.py` | `GET/POST /issuer-config` |

---

## 3. Series y Folios (`/admin/series`)

### Propósito
Gestionar las series CFDI (`cfdi_series`). Cada serie tiene un código alfabético (máx. 10 chars), tipo de CFDI y un `next_folio` que incrementa atómicamente la función `fn_assign_cfdi_folio`. El folio **no es editable** desde la UI.

### Componentes

#### Tabla principal
| Columna | Descripción |
|---------|-------------|
| Serie | Código `font-mono` en mayúsculas |
| Tipo CFDI | Badge coloreado: I=azul, E=rojo, P=violeta, T=ámbar |
| Descripción | Click para editar inline (solo `cfdi.config.manage`) |
| Próximo Folio | Solo lectura — `fn_assign_cfdi_folio` es la fuente de verdad |
| Estado | Badge Activa (emerald) / Inactiva (gris) |
| Acción | Botón Activar / Desactivar |

#### Edición inline de descripción
Al hacer click en la celda de descripción se muestra un `<Input>` con botón OK y botón X. `Enter` confirma, `Escape` cancela.

#### Filtro Todas / Solo activas
Toggle par — cambia el parámetro `active_only` en `GET /api/cfdi/series`.

#### `CreateModal`
- **Código de Serie:** `<Input>` uppercase, máx. 10 caracteres.
- **Tipo CFDI:** Grid de 4 botones (I, E, P, T) con colores de tipo.
- **Descripción:** Opcional.

### Endpoints backend
| Método | Ruta | Guard | Errores |
|--------|------|-------|---------|
| `GET` | `/api/cfdi/series?active_only=bool` | `cfdi.view` | — |
| `POST` | `/api/cfdi/series` | `cfdi.config.manage` | `409` si `(series, cfdi_type)` ya existe |
| `PATCH` | `/api/cfdi/series/{series_id}` | `cfdi.config.manage` | `404` si no existe |

### Schemas Pydantic
```python
class CfdiSeriesIn(BaseModel):
    series: str          # min_length=1, max_length=10
    cfdi_type: CfdiType  # "I" | "E" | "P" | "T"
    description: str | None = None

class CfdiSeriesUpdate(BaseModel):
    description: str | None = None
    is_active: bool | None = None
```

### Tipos TypeScript
```typescript
export interface CfdiSeriesIn {
  series: string
  cfdi_type: CfdiType
  description?: string | null
}
export interface CfdiSeriesUpdate {
  description?: string | null
  is_active?: boolean | null
}
```

### Archivos
| Archivo | Descripción |
|---------|-------------|
| `frontend/src/pages/admin/SeriesPage.tsx` | Página con tabla, `SeriesRow`, `CreateModal` |
| `frontend/src/types/cfdi.ts` | `CfdiSeriesIn`, `CfdiSeriesUpdate` |
| `frontend/src/services/cfdiService.ts` | `getSeries`, `createSeries`, `updateSeries` |
| `backend/app/schemas/cfdi_schemas.py` | `CfdiSeriesIn`, `CfdiSeriesUpdate` |
| `backend/app/services/cfdi_service.py` | `list_series`, `create_series`, `update_series` |
| `backend/app/routers/cfdi.py` | `GET/POST /series`, `PATCH /series/{id}` |

---

## 4. Invariantes de integridad

- `next_folio` solo cambia vía `fn_assign_cfdi_folio(series TEXT)` (UPDATE … FOR UPDATE RETURNING).  
  Nunca se expone como editable en la UI.
- `cfdi_issuer_config` mantiene el historial completo — solo `is_active = TRUE` es la fila vigente.
- Un código de serie es único por `(series, cfdi_type)` — la BD tiene una restricción UNIQUE en esas dos columnas.
