# Módulo 15 — Clientes y Proveedores (Directorio Maestro)

**Migración:** 0014  
**Fecha de implementación inicial:** 2026-04-28  
**Última actualización:** 2026-04-29

---

## 1. Objetivo

Sustituir los registros planos de `clientes`/`proveedores` de la capa operacional por un directorio maestro normalizado con:

- Datos fiscales multi-RFC (persona moral + persona física)
- Múltiples direcciones por entidad (entrega para clientes, recolección para proveedores)
- Contactos con rol y bandera de principal
- Catálogo de precios histórico para proveedores (patrón SCD Type 2)

---

## 2. Tablas de base de datos

| Tabla | Modelo ORM | Descripción |
|-------|------------|-------------|
| `customers` | `CustomerMaster` | Directorio maestro de clientes |
| `customer_tax_data` | `CustomerTaxData` | Datos fiscales (RFC, razón social, régimen, CP) |
| `customer_addresses` | `CustomerAddress` | Direcciones tipo DELIVERY / OTHER |
| `customer_contacts` | `CustomerContact` | Contactos con rol e indicador de principal |
| `suppliers` | `SupplierMaster` | Directorio maestro de proveedores |
| `supplier_tax_data` | `SupplierTaxData` | Datos fiscales de proveedor |
| `supplier_addresses` | `SupplierAddress` | Direcciones tipo PICKUP / OTHER |
| `supplier_contacts` | `SupplierContact` | Contactos de proveedor |
| `supplier_products` | `SupplierProductListing` | Catálogo histórico de precios |
| `sat_tax_regimes` | `SATTaxRegime` | Regímenes fiscales SAT |
| `sat_cfdi_uses` | `SATCfdiUse` | Usos de CFDI SAT |

> **Nota de naming:** Los modelos se llaman `CustomerMaster`/`SupplierMaster` para evitar colisión con `Customer`/`Supplier` legacy en `ops_models.py` (ventas/compras históricas). Los modelos legacy no se eliminan.

---

## 3. Permisos RBAC

| Permiso | Roles con acceso |
|---------|-----------------|
| `customer.view` | ADMIN, SALES, ACCOUNTING |
| `customer.manage` | ADMIN, SALES |
| `supplier.view` | ADMIN, ACCOUNTING, PURCHASING, WAREHOUSE |
| `supplier.manage` | ADMIN, PURCHASING |

---

## 4. Endpoints (24 totales)

### SAT
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sat/regimenes-fiscales` | Lista regímenes SAT |
| GET | `/api/sat/usos-cfdi` | Lista usos de CFDI |
| GET | `/api/sat/claves-producto` | Búsqueda claves producto SAT |
| GET | `/api/sat/claves-unidad` | Búsqueda claves unidad SAT |

### Clientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/clientes` | Listado paginado con filtros |
| GET | `/api/clientes/{id}` | Detalle completo con relaciones |
| POST | `/api/clientes` | Crear cliente |
| PATCH | `/api/clientes/{id}` | Editar datos generales |
| POST | `/api/clientes/{id}/tax-data` | Agregar datos fiscales |
| PUT | `/api/clientes/{id}/tax-data/{td_id}` | Actualizar datos fiscales |
| POST | `/api/clientes/{id}/addresses` | Agregar dirección |
| PUT | `/api/clientes/{id}/addresses/{addr_id}` | Actualizar dirección |
| DELETE | `/api/clientes/{id}/addresses/{addr_id}` | Eliminar dirección |
| POST | `/api/clientes/{id}/contacts` | Agregar contacto |
| PUT | `/api/clientes/{id}/contacts/{c_id}` | Actualizar contacto |
| DELETE | `/api/clientes/{id}/contacts/{c_id}` | Eliminar contacto |

### Proveedores
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/proveedores` | Listado paginado con filtros |
| GET | `/api/proveedores/{id}` | Detalle completo con relaciones |
| POST | `/api/proveedores` | Crear proveedor |
| PATCH | `/api/proveedores/{id}` | Editar datos generales |
| POST | `/api/proveedores/{id}/tax-data` | Agregar datos fiscales |
| PUT | `/api/proveedores/{id}/tax-data/{td_id}` | Actualizar datos fiscales |
| POST | `/api/proveedores/{id}/addresses` | Agregar dirección |
| PUT | `/api/proveedores/{id}/addresses/{addr_id}` | Actualizar dirección |
| DELETE | `/api/proveedores/{id}/addresses/{addr_id}` | Eliminar dirección |
| POST | `/api/proveedores/{id}/contacts` | Agregar contacto |
| PUT | `/api/proveedores/{id}/contacts/{c_id}` | Actualizar contacto |
| DELETE | `/api/proveedores/{id}/contacts/{c_id}` | Eliminar contacto |
| POST | `/api/proveedores/{id}/products` | Agregar producto al catálogo |
| PUT | `/api/proveedores/{id}/products/{sp_id}/price` | Actualizar precio (SCD Type 2) |

---

## 5. Patrón de precios histórico (SCD Type 2)

Al ejecutar `PUT /api/proveedores/{id}/products/{sp_id}/price`:

1. El registro vigente recibe `valid_to = hoy - 1 día` y `is_current = False`
2. Se inserta un nuevo registro con `valid_from = hoy`, `is_current = True`

Esto preserva todo el historial de precios para análisis y auditoría.

---

## 6. Importación de datos (seed CSV)

Scripts en `backend/scripts/`:

| Script | Datos importados |
|--------|-----------------|
| `seed_proveedores.py` | Proveedores desde `data/csv/Directorio_Clientes_Proveedores.csv` (Tipo="PROVEEDOR") — 127 registros |
| `seed_clientes.py` | Clientes desde mismo CSV (Tipo="CLIENTE") — 125 registros |

**Mapeos relevantes:**
- `categoria` → `locality`: `FORANEO` → `FOREIGN`, resto → `LOCAL`
- `estatus` → `is_active`: `ACTIVO` → True
- `TPP` (días de pago) → `payment_terms_days` (redondeado a entero)
- RFC válido → inserta fila en `customer_tax_data` / `supplier_tax_data`
- Contacto → inserta en `customer_contacts` / `supplier_contacts` si hay nombre

---

## 7. Archivos clave

### Backend
- `backend/app/models/clientes_proveedores_models.py` — ORM (CIText custom type, BigInteger Identity PKs)
- `backend/alembic/versions/20260428_0014_clientes_proveedores_ddl.py` — migración DDL + seeds SAT
- `backend/app/schemas/clientes_proveedores_schema.py` — Pydantic v2 schemas
- `backend/app/services/clientes_proveedores_service.py` — servicio async con `selectinload`
- `backend/app/routers/clientes_proveedores.py` — 24 endpoints en 3 routers

### Frontend
- `frontend/src/types/clientesProveedores.ts` — tipos TypeScript
- `frontend/src/services/clientesProveedoresService.ts` — todas las llamadas HTTP
- `frontend/src/pages/Clientes.tsx` — página completa (ver §8)
- `frontend/src/pages/ProveedoresMaestro.tsx` — página completa (ver §8)

---

## 8. Frontend — páginas

### Clientes (`/clientes`)

Layout master-detail de dos columnas:
- **Izquierda:** tabla paginada con toolbar (búsqueda, filtro Solo Activos, contador). Scroll independiente.
- **Derecha (panel 420 px):** detalle con 3 pestañas + header con acciones

**Pestañas del panel:**
| Pestaña | Funcionalidad |
|---------|---------------|
| Datos Fiscales | Visualiza y edita RFC, razón social, régimen, uso CFDI, CP; modal de edición con select de regímenes/usos desde SAT |
| Direcciones | CRUD de direcciones tipo DELIVERY/OTHER; edición inline con `AddressInlineForm` |
| Contactos | CRUD de contactos; edición inline con formulario desplegable |

**Modal "Editar cliente":** nombre comercial, tipo, localidad, días de crédito, límite, moneda, notas.

**Modal "Nuevo cliente":** código, nombre, tipo, localidad, condiciones de pago, moneda, notas.

### Proveedores (`/proveedores`)

Mismo layout master-detail con 4 pestañas:

| Pestaña | Funcionalidad |
|---------|---------------|
| Datos Fiscales | Igual que Clientes (sin uso CFDI) |
| Direcciones | CRUD tipo PICKUP/OTHER; `SupplierAddressInlineForm` |
| Contactos | CRUD con edición inline |
| Catálogo | Tabla de productos vigentes con modal de actualización de precio |

**Filtros adicionales en toolbar:** Tipo (Bienes/Servicios/Mixto), Localidad (Nacional/Extranjero), Solo Activos.

---

## 9. Componentes compartidos reutilizables

### `AddressInlineForm` (Clientes.tsx)
Formulario inline para crear/editar direcciones de cliente. Props: `title`, `form`, `setForm`, `typeOptions`, `submitting`, `onSave`, `onCancel`.

### `SupplierAddressInlineForm` (ProveedoresMaestro.tsx)
Equivalente para proveedores. Mismo contrato de props.

---

## 10. Layout y scroll

El panel de detalle es sticky (no scrollea con la tabla). Esto requiere que el contenedor de la página tenga altura acotada desde la cadena CSS:

```
AppShell main (h-screen overflow-hidden)
  └── div.h-full.overflow-auto          ← scroll de páginas normales
       └── Página (flex h-full flex-col)
            ├── Header de página (shrink-0)
            └── div.flex.min-h-0.flex-1.overflow-hidden   ← clave
                 ├── Columna izquierda (overflow-auto)     ← scroll tabla
                 └── Panel derecho (overflow-hidden)       ← sticky
                      └── tab content (overflow-y-auto)   ← scroll pestaña
```

> **Invariante**: `main` debe ser `h-screen overflow-hidden` (no `min-h-screen`). Con `min-h`, los hijos con `h-full` resuelven a `auto` y los scrollbars internos nunca se activan.
