# Catálogos SAT — Página Admin y Sync desde SAT (2026-04-29)

## Contexto

Se implementó la página **Administración → Catálogos SAT** (`/admin/sat`), que
estaba como placeholder.  El módulo cubre los seis catálogos SAT CFDI 4.0 que
ya existían en la base de datos, añade visualización completa con búsqueda y
agrega un mecanismo de sincronización directa contra la fuente oficial del SAT.

También se corrigió un bug que causaba error 401 en las pestañas **Formas de
Pago** y **Métodos de Pago**: las funciones de servicio no enviaban el token de
autenticación.

---

## Tablas involucradas (sin cambios de esquema)

Todas las tablas existían desde migraciones anteriores.  No se generó ninguna
migración nueva.

| Tabla | Migración origen | Filas aprox. |
|---|---|---|
| `sat_product_keys` | `0012` (DDL) | ~70 seeded → ~52 000 tras sync |
| `sat_unit_keys` | `0012` (DDL) | 34 seeded → ~200 tras sync |
| `sat_tax_regimes` | `0014` (DDL) | 19 |
| `sat_cfdi_uses` | `0014` (DDL) | 24 |
| `sat_payment_forms` | `0017` (DDL) / `0018` (seed) | 8 seeded → 22 tras sync |
| `sat_payment_methods` | `0017` (DDL) / `0018` (seed) | 2 |

> **Nota:** La migración `0018` solo sembró 8 formas de pago.  El catálogo
> oficial SAT c_FormaPago tiene 22 entradas.  El sync canónico agrega las 14
> restantes.

---

## Backend

### Nuevo servicio — `backend/app/services/sat_sync_service.py`

Centraliza toda la lógica de sincronización.

**Estrategia por catálogo:**

| Catálogo | Estrategia | Fuente |
|---|---|---|
| `sat_payment_forms` | Datos canónicos hardcodeados | Spec CFDI 4.0 |
| `sat_payment_methods` | Datos canónicos hardcodeados | Spec CFDI 4.0 |
| `sat_tax_regimes` | Datos canónicos hardcodeados | Spec CFDI 4.0 |
| `sat_cfdi_uses` | Datos canónicos hardcodeados | Spec CFDI 4.0 |
| `sat_unit_keys` | Descarga + parseo Excel | URL SAT configurable |
| `sat_product_keys` | Descarga + parseo Excel | URL SAT configurable |

**Parseo Excel:**
- Formato `.xls` (SAT oficial): usa `xlrd 2.0`
- Formato `.xlsx`: usa `openpyxl 3.1`
- Detección automática por extensión de URL
- Hojas parseadas: `c_ClaveProdServ`, `c_ClaveUnidad`
- Upsert en batches (500 filas para unidades, 1 000 para productos) para
  evitar timeouts con el catálogo de 52k entradas

**URL por defecto:**
```
http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/catCFDI.xls
```

**Función principal:**
```python
run_full_sync(db, include_product_keys, include_unit_keys, sat_url) -> SyncReport
```

Retorna un `SyncReport` con `CatalogSyncResult` por cada catálogo procesado
(filas procesadas, filas upserted, error si aplica).

---

### Nuevo router — `backend/app/routers/sat_admin.py`

```
POST /api/admin/sat/sync
```

**Permiso requerido:** `cfdi.config.manage`

**Request body:**
```json
{
  "include_product_keys": true,
  "include_unit_keys": true,
  "sat_url": "http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/catCFDI.xls"
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "catalog": "sat_payment_forms",
      "rows_processed": 22,
      "rows_upserted": 22,
      "error": null
    },
    ...
  ]
}
```

Registrado en `main.py` como `sat_admin_router`.

---

### Dependencias añadidas — `backend/requirements.txt`

```
openpyxl==3.1.5
xlrd==2.0.1
```

---

## Frontend

### Bug fix — `frontend/src/services/comprasService.ts`

`getSatPaymentForms` y `getSatPaymentMethods` no enviaban el token JWT.
Los endpoints de compras requieren `UserDep` (autenticación obligatoria).

**Antes:**
```ts
export function getSatPaymentForms(signal?: AbortSignal)
export function getSatPaymentMethods(signal?: AbortSignal)
```

**Después:**
```ts
export function getSatPaymentForms(token: string | null, signal?: AbortSignal)
export function getSatPaymentMethods(token: string | null, signal?: AbortSignal)
```

---

### Nuevos tipos — `frontend/src/types/clientesProveedores.ts`

```ts
export type SATProductKey = {
  id: string
  code: string
  description: string
  is_active: boolean
}

export type SATUnitKey = {
  id: string
  code: string
  description: string
  is_active: boolean
}
```

---

### Nuevas funciones de servicio — `frontend/src/services/clientesProveedoresService.ts`

```ts
searchSatProductKeys(token, q, limit = 100, signal?)  // GET /api/sat/claves-producto
searchSatUnitKeys(token, q, limit = 100, signal?)     // GET /api/sat/claves-unidad
```

---

### Página — `frontend/src/pages/admin/SatPage.tsx`

Reemplaza el placeholder anterior.  Arquitectura en sub-componentes por pestaña.

**6 pestañas:**

| Pestaña | Componente | Endpoint | Característica |
|---|---|---|---|
| Claves Producto/Servicio | `ClavesProductoTab` | `GET /api/sat/claves-producto` | Búsqueda live, máx 100 resultados |
| Claves Unidad | `ClavesUnidadTab` | `GET /api/sat/claves-unidad` | Búsqueda live, máx 100 resultados |
| Regímenes Fiscales | `RegimenesFiscalesTab` | `GET /api/sat/regimenes-fiscales` | Lista completa con badge Física/Moral/Ambas |
| Usos CFDI | `UsosCfdiTab` | `GET /api/sat/usos-cfdi` | Lista completa con badge aplica a |
| Formas de Pago | `FormasPagoTab` | `GET /api/compras/sat/formas-pago` | Lista completa con badge activo |
| Métodos de Pago | `MetodosPagoTab` | `GET /api/compras/sat/metodos-pago` | Badge Contado (PUE) / Crédito (PPD) |

**Panel de sincronización (`SyncPanel`):**
- Colapsable, visible solo para usuarios con `cfdi.config.manage`
- Checkboxes: incluir claves producto / incluir claves unidad
- Campo URL editable (default URL oficial SAT)
- Botón "Sincronizar ahora" con spinner
- Resultados por catálogo: tarjeta verde (éxito + filas) o roja (error con mensaje)
- Tras sync exitoso dispara `triggerRefetch` que fuerza re-fetch en todos los tabs

**Refetch tras sync:**  
Cada tab recibe `triggerRefetch: number` como prop.  Al cambiar su valor,
`useCallback` cambia referencia y `useApi` re-ejecuta el fetch.

---

## Flujo completo

```
Admin → /admin/sat → SatPage
  ├─ SyncPanel (colapsado por defecto)
  │    └─ POST /api/admin/sat/sync
  │         ├─ sync_payment_forms()    ← datos canónicos hardcodeados
  │         ├─ sync_payment_methods()  ← datos canónicos hardcodeados
  │         ├─ sync_tax_regimes()      ← datos canónicos hardcodeados
  │         ├─ sync_cfdi_uses()        ← datos canónicos hardcodeados
  │         ├─ _download_sat_catalog(url)  ← httpx GET
  │         ├─ sync_unit_keys_from_excel() ← xlrd/openpyxl parse
  │         └─ sync_product_keys_from_excel() ← xlrd/openpyxl parse
  └─ 6 tabs de visualización (DataTable + búsqueda donde aplica)
```

---

## Archivos modificados/creados

| Archivo | Tipo | Descripción |
|---|---|---|
| `backend/requirements.txt` | Modificado | +openpyxl, +xlrd |
| `backend/app/main.py` | Modificado | Registra `sat_admin_router` |
| `backend/app/services/sat_sync_service.py` | **Nuevo** | Servicio de sync SAT |
| `backend/app/routers/sat_admin.py` | **Nuevo** | Router `POST /api/admin/sat/sync` |
| `frontend/src/types/clientesProveedores.ts` | Modificado | +SATProductKey, +SATUnitKey |
| `frontend/src/services/clientesProveedoresService.ts` | Modificado | +searchSatProductKeys, +searchSatUnitKeys |
| `frontend/src/services/comprasService.ts` | Modificado | Fix token en getSatPaymentForms/Methods |
| `frontend/src/pages/admin/SatPage.tsx` | Modificado | Implementación completa |
