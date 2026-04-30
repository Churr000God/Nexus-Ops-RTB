# Módulo 14 — Clientes y Proveedores (Directorio Maestro)

**Migración:** 0014  
**Fecha de implementación inicial:** 2026-04-28  
**Última actualización:** 2026-04-30

---

## 1. Objetivo

Sustituir los registros planos de `clientes`/`proveedores` de la capa operacional por un directorio maestro normalizado con:

- Datos fiscales multi-RFC (persona moral + persona física)
- Múltiples direcciones por entidad (entrega para clientes, recolección para proveedores)
- Contactos con rol y bandera de principal
- Catálogo de precios histórico por proveedor (patrón SCD Type 2)
- Vista cross-proveedor de todo el catálogo consolidado
- Validación de unicidad de código en creación

---

## 2. Tablas de base de datos

### 2.1 Descripción de tablas

| Tabla | Modelo ORM | Descripción |
|-------|------------|-------------|
| `customers` | `CustomerMaster` | Directorio maestro de clientes |
| `customer_tax_data` | `CustomerTaxData` | Datos fiscales: RFC, razón social, régimen SAT, uso CFDI, CP |
| `customer_addresses` | `CustomerAddress` | Direcciones tipo DELIVERY / OTHER |
| `customer_contacts` | `CustomerContact` | Contactos con rol e indicador de principal |
| `suppliers` | `SupplierMaster` | Directorio maestro de proveedores |
| `supplier_tax_data` | `SupplierTaxData` | Datos fiscales de proveedor (sin uso CFDI) |
| `supplier_addresses` | `SupplierAddress` | Direcciones tipo PICKUP / OTHER |
| `supplier_contacts` | `SupplierContact` | Contactos de proveedor |
| `supplier_products` | `SupplierProductListing` | Catálogo histórico de precios por proveedor (SCD Type 2) |
| `sat_tax_regimes` | `SATTaxRegime` | Regímenes fiscales SAT (seeded desde CSV oficial) |
| `sat_cfdi_uses` | `SATCfdiUse` | Usos de CFDI SAT (seeded desde CSV oficial) |

> **Nota de naming:** Los modelos se llaman `CustomerMaster`/`SupplierMaster` para evitar colisión con `Customer`/`Supplier` legacy en `ops_models.py` (ventas/compras históricas). Los modelos legacy no se eliminan.

### 2.2 Esquema `customers`

```sql
customers (
  customer_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          CITEXT NOT NULL,           -- clave única normalizada (case-insensitive)
  business_name TEXT NOT NULL,
  customer_type VARCHAR(20) DEFAULT 'STANDARD',  -- STANDARD | VIP | WHOLESALE
  locality      VARCHAR(20) DEFAULT 'LOCAL',     -- LOCAL | FOREIGN
  payment_terms_days INT DEFAULT 0,
  credit_limit  NUMERIC(14,2),
  currency      VARCHAR(10) DEFAULT 'MXN',
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_customers_code UNIQUE (code)
)
```

### 2.3 Esquema `suppliers`

```sql
suppliers (
  supplier_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                  CITEXT NOT NULL,
  business_name         TEXT NOT NULL,
  supplier_type         VARCHAR(20) DEFAULT 'GOODS',   -- GOODS | SERVICES | BOTH
  locality              VARCHAR(20) DEFAULT 'LOCAL',   -- LOCAL | FOREIGN
  is_occasional         BOOLEAN DEFAULT FALSE,
  payment_terms_days    INT DEFAULT 0,
  avg_payment_time_days INT,
  currency              VARCHAR(10) DEFAULT 'MXN',
  is_active             BOOLEAN DEFAULT TRUE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_suppliers_code UNIQUE (code)
)
```

### 2.4 Esquema `supplier_products` (catálogo histórico)

```sql
supplier_products (
  supplier_product_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id         BIGINT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
  product_id          UUID REFERENCES productos(id) ON DELETE SET NULL,  -- vinculación al catálogo interno
  supplier_sku        TEXT,           -- SKU del proveedor (puede diferir del SKU interno)
  unit_cost           NUMERIC(14,4) NOT NULL DEFAULT 0,
  currency            VARCHAR(10) DEFAULT 'MXN',
  lead_time_days      INT,
  moq                 NUMERIC(14,4),  -- cantidad mínima de orden
  is_available        BOOLEAN DEFAULT TRUE,
  is_preferred        BOOLEAN DEFAULT FALSE,
  valid_from          DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to            DATE,           -- NULL = registro vigente
  is_current          BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT now()
)
```

**Índice clave:** `idx_supplier_products_current` sobre `(supplier_id, is_current)` para lecturas rápidas del catálogo vigente.

### 2.5 Tablas de sub-entidades (estructura idéntica para clientes y proveedores)

**`customer_tax_data` / `supplier_tax_data`**

```sql
(tax_data_id, customer_id|supplier_id, rfc CITEXT, legal_name TEXT,
 tax_regime_id INT → sat_tax_regimes, cfdi_use_id VARCHAR → sat_cfdi_uses,
 zip_code VARCHAR(10), is_default BOOLEAN)
```

**`customer_addresses` / `supplier_addresses`**

```sql
(address_id, customer_id|supplier_id,
 address_type VARCHAR(10),  -- DELIVERY|OTHER  /  PICKUP|OTHER
 tax_data_id INT (opcional, vincula dirección a RFC),
 label, street, exterior_number, interior_number,
 neighborhood, city, state, country DEFAULT 'MX',
 zip_code, is_default BOOLEAN)
```

**`customer_contacts` / `supplier_contacts`**

```sql
(contact_id, customer_id|supplier_id,
 full_name TEXT, role_title TEXT,
 email TEXT, phone TEXT, is_primary BOOLEAN)
```

---

## 3. Relaciones y restricciones FK

```
customers ──< customer_tax_data      (CASCADE DELETE)
customers ──< customer_addresses     (CASCADE DELETE)
customers ──< customer_contacts      (CASCADE DELETE)

suppliers ──< supplier_tax_data      (CASCADE DELETE)
suppliers ──< supplier_addresses     (CASCADE DELETE)
suppliers ──< supplier_contacts      (CASCADE DELETE)
suppliers ──< supplier_products      (CASCADE DELETE)

supplier_products >── productos      (SET NULL al eliminar producto)

purchase_orders   >── suppliers      (RESTRICT — no se puede eliminar proveedor con OCs)
goods_receipts    >── suppliers      (RESTRICT)
supplier_invoices >── suppliers      (RESTRICT)
```

---

## 4. Lógica de negocio

### 4.1 Unicidad de código

El campo `code` se almacena en `CITEXT` (case-insensitive). Al crear un cliente o proveedor:

1. El servicio convierte el código a `UPPER()`.
2. Se ejecuta un `SELECT` previo para verificar si ya existe ese código.
3. Si existe → `ValueError` → router devuelve `HTTP 409 Conflict` con mensaje: `"Ya existe un proveedor con el código 'X'"`.
4. La restricción `UNIQUE` en BD es la última línea de defensa en caso de race condition.

```python
# services/clientes_proveedores_service.py
code = data.code.upper()
existing = (await self.db.execute(
    select(SupplierMaster.supplier_id).where(SupplierMaster.code == code)
)).scalar_one_or_none()
if existing is not None:
    raise ValueError(f"Ya existe un proveedor con el código '{code}'")
```

### 4.2 Catálogo histórico de precios (SCD Type 2)

Al actualizar el precio de un producto de proveedor (`PUT .../products/{id}/price`):

1. El registro vigente (`is_current = True`) recibe `valid_to = hoy - 1 día` e `is_current = False`.
2. Se inserta un nuevo registro con `valid_from = hoy`, `is_current = True`, con los nuevos valores.

Esto preserva todo el historial para auditoría y análisis de variación de costos.

### 4.3 `unit_cost` vs `current_avg_cost`

| Campo | Tabla | Origen | Significado |
|-------|-------|--------|-------------|
| `unit_cost` | `supplier_products` | Manual o script | Último precio cotizado por el proveedor |
| `current_avg_cost` | `productos` | Trigger automático al registrar `goods_receipts` | Promedio ponderado de compras reales |

El `unit_cost` en `supplier_products` **no se actualiza automáticamente** cuando se registra una OC. Se actualiza mediante:
- Edición manual desde el panel de catálogo del proveedor
- Re-ejecución del script `seed_supplier_products.py` (carga masiva)

### 4.4 Catálogo Cross-Proveedor

El endpoint `GET /api/proveedores/catalogo` hace un JOIN:

```sql
supplier_products sp
  JOIN suppliers s ON s.supplier_id = sp.supplier_id
  LEFT JOIN productos p ON p.id = sp.product_id
WHERE sp.is_current = TRUE
  [AND sp.supplier_id = :supplier_id]
  [AND sp.product_id IS NOT NULL]         -- solo_vinculados=true
  [AND (p.nombre ILIKE :q OR p.sku ILIKE :q
        OR s.business_name ILIKE :q
        OR sp.supplier_sku ILIKE :q)]
```

Un producto está **vinculado** cuando `product_id IS NOT NULL` (existe match con el catálogo interno de `productos`). Un producto está **sin vincular** cuando fue importado desde el CSV de cross-proveedor pero no tiene equivalente en catálogo.

---

## 5. Permisos RBAC

| Permiso | Roles con acceso |
|---------|-----------------|
| `customer.view` | ADMIN, SALES, ACCOUNTING |
| `customer.manage` | ADMIN, SALES |
| `supplier.view` | ADMIN, ACCOUNTING, PURCHASING, WAREHOUSE |
| `supplier.manage` | ADMIN, PURCHASING |

---

## 6. Endpoints (26 totales)

### SAT (auxiliares para formularios)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sat/regimenes-fiscales` | Lista regímenes SAT |
| GET | `/api/sat/usos-cfdi` | Lista usos de CFDI |
| GET | `/api/sat/claves-producto` | Búsqueda claves producto SAT (`?q=`) |
| GET | `/api/sat/claves-unidad` | Búsqueda claves unidad SAT (`?q=`) |

### Clientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/clientes` | Listado paginado (`limit`, `offset`, `search`, `solo_activos`, `customer_type`, `locality`) |
| GET | `/api/clientes/{id}` | Detalle con tax_data, addresses, contacts |
| POST | `/api/clientes` | Crear cliente — **409 si código duplicado** |
| PATCH | `/api/clientes/{id}` | Editar datos generales |
| POST | `/api/clientes/{id}/tax-data` | Agregar RFC |
| PUT | `/api/clientes/{id}/tax-data/{td_id}` | Actualizar RFC |
| POST | `/api/clientes/{id}/addresses` | Agregar dirección |
| PUT | `/api/clientes/{id}/addresses/{addr_id}` | Actualizar dirección |
| DELETE | `/api/clientes/{id}/addresses/{addr_id}` | Eliminar dirección |
| POST | `/api/clientes/{id}/contacts` | Agregar contacto |
| PUT | `/api/clientes/{id}/contacts/{c_id}` | Actualizar contacto |
| DELETE | `/api/clientes/{id}/contacts/{c_id}` | Eliminar contacto |

### Proveedores
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/proveedores` | Listado paginado (`search`, `solo_activos`, `supplier_type`, `locality`, `is_occasional`) |
| GET | `/api/proveedores/catalogo` | Catálogo cross-proveedor (`search`, `supplier_id`, `solo_vinculados`) |
| GET | `/api/proveedores/{id}` | Detalle con tax_data, addresses, contacts, current_products |
| POST | `/api/proveedores` | Crear proveedor — **409 si código duplicado** |
| PATCH | `/api/proveedores/{id}` | Editar datos generales |
| POST | `/api/proveedores/{id}/tax-data` | Agregar RFC |
| PUT | `/api/proveedores/{id}/tax-data/{td_id}` | Actualizar RFC |
| POST | `/api/proveedores/{id}/addresses` | Agregar dirección |
| PUT | `/api/proveedores/{id}/addresses/{addr_id}` | Actualizar dirección |
| DELETE | `/api/proveedores/{id}/addresses/{addr_id}` | Eliminar dirección |
| POST | `/api/proveedores/{id}/contacts` | Agregar contacto |
| PUT | `/api/proveedores/{id}/contacts/{c_id}` | Actualizar contacto |
| DELETE | `/api/proveedores/{id}/contacts/{c_id}` | Eliminar contacto |
| POST | `/api/proveedores/{id}/products` | Agregar producto al catálogo |
| PUT | `/api/proveedores/{id}/products/{sp_id}/price` | Actualizar precio (SCD Type 2) |

> **Orden crítico en el router:** `/catalogo` debe registrarse **antes** de `/{supplier_id}` para que FastAPI no lo interprete como un ID numérico.

---

## 7. Importación de datos (scripts seed)

### 7.1 Directorio de clientes y proveedores

Scripts en `backend/scripts/`:

| Script | CSV fuente | Registros |
|--------|-----------|-----------|
| `seed_proveedores.py` | `data/csv/Directorio_Clientes_Proveedores.csv` (Tipo="PROVEEDOR") | ~127 proveedores |
| `seed_clientes.py` | mismo CSV (Tipo="CLIENTE") | ~125 clientes |

**Ejecución:**
```bash
docker compose exec backend bash -c "cd /app && python /scripts/seed_proveedores.py"
docker compose exec backend bash -c "cd /app && python /scripts/seed_clientes.py"
```

**Mapeos clave:**
- `categoria` → `locality`: `FORANEO` → `FOREIGN`, resto → `LOCAL`
- `estatus` → `is_active`: `ACTIVO` → True
- `TPP` (días de pago) → `payment_terms_days`
- RFC válido → inserta fila en `customer_tax_data` / `supplier_tax_data`
- Contacto → inserta en `customer_contacts` / `supplier_contacts` si hay nombre

### 7.2 Catálogo cross-proveedor

Script: `scripts/seed_supplier_products.py`  
CSV fuente: `data/csv/Catalogo-Cross-Proveedor.csv`

**Proceso:**
1. Limpia filas con SKU vacío o proveedor desconocido
2. Carga todos los pares `(supplier_id, lower(supplier_sku))` existentes en un SELECT batch (evita N+1)
3. Para cada fila del CSV, determina si es INSERT o UPDATE
4. Vincula `product_id` si existe un producto en `productos` con el mismo SKU (case-insensitive)
5. Asigna `unit_cost` desde historial de OCs de los últimos 6 meses (si existe); de lo contrario queda en 0

**Ejecución:**
```bash
# Modo simulación
docker compose exec backend bash -c "cd /app && python /scripts/seed_supplier_products.py --dry-run"

# Ejecución real
docker compose exec backend bash -c "cd /app && python /scripts/seed_supplier_products.py"
```

**Estadísticas actuales:** 1,083 registros en `supplier_products`; costos en 0 (sin historial de OCs registradas).

---

## 8. Frontend — páginas

### 8.1 Clientes (`/clientes`)

Layout master-detail de dos columnas con scroll independiente:

- **Izquierda (tabla):** DataTable paginado + toolbar con búsqueda, filtro Solo Activos, filtro Tipo, filtro Localidad, contador total. Vista tabla / vista tarjetas (ViewToggle).
- **Panel derecho (420 px sticky):** detalle con header de acciones + 3 pestañas.

**KPI cards en cabecera de página:**
| KPI | Descripción |
|-----|-------------|
| Total Clientes | Count total en BD |
| Activos | Con `is_active = true` |
| Con crédito | Con `credit_limit IS NOT NULL` |
| Extranjeros | Con `locality = 'FOREIGN'` |

**Pestañas del panel de detalle:**
| Pestaña | Funcionalidad |
|---------|---------------|
| Datos Fiscales | Visualiza/edita RFC, razón social, régimen SAT, uso CFDI, CP; modal con selects SAT |
| Direcciones | CRUD inline (AddressInlineForm): tipo DELIVERY/OTHER, campos de domicilio, is_default |
| Contactos | CRUD inline: nombre, cargo, email, teléfono, is_primary |

**Modales:**
- **Nuevo cliente:** código, nombre comercial, tipo (STANDARD/VIP/WHOLESALE), localidad, días de pago, límite de crédito, moneda, notas.
- **Editar cliente:** mismos campos excepto código.

### 8.2 Proveedores (`/proveedores`)

Mismo layout master-detail con 4 pestañas:

**KPI cards:**
| KPI | Descripción |
|-----|-------------|
| Total Proveedores | Count total |
| Activos | `is_active = true` |
| Eventuales | `is_occasional = true` |
| Extranjeros | `locality = 'FOREIGN'` |

**Pestañas del panel:**
| Pestaña | Funcionalidad |
|---------|---------------|
| Datos Fiscales | Igual que clientes (sin uso CFDI) |
| Direcciones | CRUD tipo PICKUP/OTHER |
| Contactos | CRUD con edición inline |
| Catálogo | Tabla de `current_products` del proveedor; modal para actualizar precio (SCD Type 2) |

### 8.3 Catálogo Cross-Proveedor (`/proveedores/catalogo`)

Vista consolidada de todos los precios vigentes de todos los proveedores:

**Filtros:**
- Búsqueda libre (nombre producto, SKU interno, SKU proveedor, nombre proveedor)
- Filtro por proveedor específico (dropdown)
- Toggle "Solo vinculados" (productos que tienen match con catálogo interno)

**Vista tabla:** proveedor, SKU proveedor, producto (si vinculado), costo, moneda, lead time, MOQ, disponibilidad, preferido.

**Vista tarjetas (ProductoComparativaCard):** comparativa visual por producto con badge de estado vinculado/disponible/preferido.

**Badges:**
- `CostBadge`: muestra costo formateado o "Sin costo" si es 0
- `LinkedBadge`: "Vinculado" / "Sin vincular" según `product_id`
- `AvailableBadge`: "Disponible" / "No disponible"

---

## 9. Flujo de error — código duplicado

```
Usuario llena form "Nuevo Proveedor" con código existente
    ↓
POST /api/proveedores  {code: "CORDMARK", ...}
    ↓
Service: SELECT supplier_id WHERE code = 'CORDMARK' → encontrado
    ↓
raise ValueError("Ya existe un proveedor con el código 'CORDMARK'")
    ↓
Router: except ValueError → HTTPException(409, detail=mensaje)
    ↓
Frontend: catch ApiError { if status === 409 → toast.error(err.message) }
    ↓
Toast: "Ya existe un proveedor con el código 'CORDMARK'"
```

---

## 10. Componentes reutilizables

| Componente | Archivo | Uso |
|-----------|---------|-----|
| `AddressInlineForm` | `Clientes.tsx` | Formulario inline crear/editar dirección de cliente |
| `SupplierAddressInlineForm` | `ProveedoresMaestro.tsx` | Ídem para proveedor |
| `ViewToggle` | `components/common/ViewToggle.tsx` | Botones tabla/tarjetas |
| `EmptyState` | `components/common/EmptyState.tsx` | Estado vacío genérico |
| `KpiCard` | Inline en páginas | Card de métrica con icono y label |
| `CostBadge` / `LinkedBadge` / `AvailableBadge` | `CatalogoPage.tsx` | Badges de estado en catálogo |
| `ProductoComparativaCard` | `CatalogoPage.tsx` | Tarjeta de producto en vista grid |

---

## 11. Layout y scroll (invariante CSS)

El panel de detalle es sticky. Requiere que el contenedor tenga altura acotada:

```
AppShell main (h-screen overflow-hidden)
  └── div.h-full.overflow-auto              ← scroll de páginas normales
       └── Página (flex h-full flex-col)
            ├── Header de página (shrink-0)
            └── div.flex.min-h-0.flex-1.overflow-hidden   ← clave
                 ├── Columna izquierda (overflow-auto)    ← scroll tabla
                 └── Panel derecho (overflow-hidden)       ← sticky
                      └── tab content (overflow-y-auto)   ← scroll pestaña
```

> **Invariante:** `main` debe ser `h-screen overflow-hidden` (no `min-h-screen`). Con `min-h`, los hijos con `h-full` resuelven a `auto` y los scrollbars internos nunca se activan.

---

## 12. Archivos clave

### Backend
| Archivo | Descripción |
|---------|-------------|
| `backend/app/models/clientes_proveedores_models.py` | ORM: CIText custom type, BigInt Identity PKs, relaciones |
| `backend/alembic/versions/20260428_0014_clientes_proveedores_ddl.py` | Migración DDL + seeds SAT |
| `backend/app/schemas/clientes_proveedores_schema.py` | Pydantic v2 schemas (Read/Create/Update/Detail) |
| `backend/app/services/clientes_proveedores_service.py` | Servicio async: selectinload, pre-checks de unicidad, SCD Type 2 |
| `backend/app/routers/clientes_proveedores.py` | 26 endpoints en 3 routers: clientes, proveedores, sat-cp |
| `scripts/seed_proveedores.py` | Importación inicial de proveedores desde CSV |
| `scripts/seed_clientes.py` | Importación inicial de clientes desde CSV |
| `scripts/seed_supplier_products.py` | Importación catálogo cross-proveedor (batch upsert, SCD Type 2) |

### Frontend
| Archivo | Descripción |
|---------|-------------|
| `frontend/src/types/clientesProveedores.ts` | Tipos TypeScript de todas las entidades |
| `frontend/src/services/clientesProveedoresService.ts` | Todas las llamadas HTTP del módulo |
| `frontend/src/pages/Clientes.tsx` | Página completa de clientes |
| `frontend/src/pages/ProveedoresMaestro.tsx` | Página completa de proveedores |
| `frontend/src/pages/proveedores/CatalogoPage.tsx` | Catálogo cross-proveedor |
| `frontend/src/components/common/ViewToggle.tsx` | Toggle tabla/tarjetas |
| `frontend/src/components/common/EmptyState.tsx` | Estado vacío |
