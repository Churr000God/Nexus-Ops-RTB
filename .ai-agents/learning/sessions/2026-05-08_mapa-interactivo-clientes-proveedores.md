# Sesion: Mapa interactivo en Clientes & Proveedores

**Fecha:** 2026-05-08
**Agente:** Claude Sonnet 4.6
**Area:** frontend + backend
**Sprint:** —

## Objetivo

Agregar una vista de mapa interactivo a las páginas de Clientes (`/clientes`) y Proveedores (`/proveedores`) que muestre la ubicación de cada entidad con un pin en el mapa y un tooltip al pasar el mouse.

## Decisiones de diseño

- **Librería de mapas:** Leaflet + OpenStreetMap (libre, sin API key). Instalado `leaflet` + `@types/leaflet`.
- **Geocodificación:** Nominatim API (gratuita, límite 1 req/s). Se usan los campos `city, state, zip_code, country` de la dirección predeterminada para construir la query.
- **Caché:** Módulo-level `Map<string, coords>` que sobrevive re-renders y cambios de vista.
- **Sin lat/lng en BD:** Los modelos tienen solo campos de texto de dirección; se geocodifica en cliente.
- **Carga lazy:** Los datos geo se obtienen del nuevo endpoint `/geo` solo cuando el usuario activa la vista de mapa por primera vez (ref flag `geoLoadedRef`).
- **Routing FastAPI:** Los endpoints `/geo` se registraron ANTES de `/{id}` para evitar captura por path param.

## Cambios realizados

### Backend

- `backend/app/schemas/clientes_proveedores_schema.py` — Añadidos: `GeoAddress`, `CustomerGeoItem`, `CustomerGeoResponse`, `SupplierGeoItem`, `SupplierGeoResponse`
- `backend/app/services/clientes_proveedores_service.py` — Nuevos métodos: `get_customers_geo()`, `get_suppliers_geo()`
- `backend/app/routers/clientes_proveedores.py` — Nuevos endpoints: `GET /api/clientes/geo`, `GET /api/proveedores/geo`

### Frontend

- `frontend/package.json` — `leaflet` + `@types/leaflet` instalados
- `frontend/src/types/clientesProveedores.ts` — Añadidos: `GeoAddressItem`, `CustomerGeoItem`, `CustomerGeoResponse`, `SupplierGeoItem`, `SupplierGeoResponse`
- `frontend/src/services/clientesProveedoresService.ts` — Añadidos: `getCustomersGeo()`, `getSuppliersGeo()`
- `frontend/src/components/common/EntityMap.tsx` — Nuevo componente genérico con geocoding Nominatim, markers SVG personalizados, tooltips dark-theme
- `frontend/src/pages/Clientes.tsx` — viewMode extendido a `"table"|"grid"|"map"`, botón Mapa en ViewToggle, vista de mapa con EntityMap
- `frontend/src/pages/ProveedoresMaestro.tsx` — Mismos cambios que Clientes pero adaptado a proveedores (colores por tipo: Bienes=azul, Servicios=violeta, Mixto=teal)

## Comportamiento

- Mapa centrado en México (lat 23.63, lng -102.55), zoom 5
- Pins coloreados: activo=azul (clientes) / por tipo (proveedores), inactivo=gris
- Hover sobre pin despliega tooltip dark con: nombre, código, badge de tipo, localidad, moneda, estado
- Clic en pin abre el panel lateral de detalle (mismo que tabla/grid)
- Progress overlay durante geocodificación: "Geocodificando… N/Total"
- Si no hay coordenadas geocodificables, muestra overlay "Sin ubicaciones geocodificadas"

## Builds

- `docker compose build frontend` ✅
- `docker compose build backend` ✅
- `tsc -b` sin errores ✅
- `GET /api/clientes/geo` devuelve 401 (correcto, requiere auth) ✅
