# CRUD completo de Notas de Remision en frontend (2026-05-06)

Se reescribio la pagina `NotasRemisionPage.tsx` para transformar el listado basico existente en una interfaz completa de gestion de Notas de Remision (Delivery Notes). El backend ya contaba con el modelo, schemas, router y servicio implementados; este cambio unicamente impacta el frontend.

---

## Contexto

El modulo de Ventas y Logistica (`/api/ventas-logistica`) ya soportaba el ciclo completo NR → Cotizacion → Pedido → Envio/CFDI/Cobro desde el backend. La pagina de Notas de Remision en el frontend solo mostraba un listado tabular sin acciones. Esta sesion agrega el CRUD completo desde el lado del cliente.

---

## Frontend

### Archivo modificado

| Archivo | Descripcion |
|---|---|
| `frontend/src/pages/NotasRemisionPage.tsx` | Reescritura completa: listado, filtros, panel de detalle, modal de creacion/edicion, cancelacion |

### Funcionalidades agregadas

#### 1. Listado enriquecido
- **Filtro por estado:** dropdown con todos los estados (`DRAFT`, `ISSUED`, `DELIVERED`, `TRANSFORMED`, `PARTIALLY_INVOICED`, `INVOICED`, `CANCELLED`).
- **Busqueda local:** input de texto que filtra por numero de NR, ID de cliente u orden de compra del cliente (`customer_po_number`).
- **Columnas:** NR, Cliente ID, Fecha de emision, Fecha de entrega, Estado (badge coloreado), OC Cliente, Total, Numero de partidas, Acciones.

#### 2. Panel de detalle expandible
- Se despliega al hacer clic en el icono de ojo de una fila.
- Muestra tarjetas de totales: Subtotal, Impuesto, Total, Partidas.
- Tabla completa de items con: descripcion, SKU, cantidad, precio unitario, descuento, subtotal y total.

#### 3. Modal de creacion (`DeliveryNoteFormModal`)
- **Datos generales:**
  - Autocomplete de clientes con debounce 300 ms (consume `/api/clientes?search=`).
  - Fecha de emision (obligatoria, bloqueada en edicion).
  - Fecha de entrega estimada.
  - OC Cliente y fecha OC.
  - Notas generales.
- **Partidas dinamicas:**
  - Tabla editable inline para agregar/quitar items.
  - Campos por item: descripcion, SKU, cantidad, precio unitario, descuento, tasa de IVA.
  - Calculo de totales en tiempo real (subtotal, impuesto, total estimado).
- **Validaciones:** cliente obligatorio, fecha de emision obligatoria, al menos una partida, descripcion no vacia, cantidad > 0, precio >= 0.

#### 4. Modal de edicion
- Permite modificar datos generales de una NR existente.
- No permite cambiar cliente ni fecha de emision (estos determinan el numero de serie generado por el backend).
- No permite modificar partidas existentes desde el frontend (limitacion intencional para evitar inconsistencias contables).

#### 5. Cancelacion
- Accion disponible para NR en estado `DRAFT` o `ISSUED`.
- Solicita motivo de cancelacion via `window.prompt`.
- Envia `PATCH` con `{ status: "CANCELLED", cancellation_reason }`.

### Permisos RBAC

| Permiso | Uso en pagina |
|---|---|
| `delivery_note.create` | Muestra boton "Nueva NR" |
| `delivery_note.manage` | Muestra botones Editar y Cancelar en filas elegibles |

### Servicios utilizados

- `ventasLogisticaService.getDeliveryNotes()` — listado paginado/filtrado.
- `ventasLogisticaService.createDeliveryNote()` — creacion.
- `ventasLogisticaService.updateDeliveryNote()` — edicion y cancelacion.
- `clientesProveedoresService.listCustomers()` — autocomplete de clientes.

### Dependencias

Ninguna nueva. Se reutilizaron:
- `@/components/common/DataTable`
- `@/components/ui/button`
- `@/hooks/useApi`
- `@/hooks/usePermission`
- `lucide-react` (iconos)
- `sonner` (toasts)

---

## Verificacion

1. `npm run build` en frontend — ✅ TypeScript compila sin errores, Vite build exitoso.
2. `python -m py_compile` en backend — ✅ sin errores (no se modifico codigo backend).
3. Endpoints existentes probados en Swagger `/docs` previamente.

---

## Notas de despliegue

No requiere migraciones ni cambios de backend. Solo rebuild del contenedor frontend:

```bash
docker compose up -d --build frontend
```

---

## Siguiente paso

- Agregar accion "Emitir" para transicionar `DRAFT → ISSUED`.
- Permitir seleccionar direccion de envio desde las direcciones del cliente.
- Integrar vinculacion de NR a cotizaciones formales (`POST /quotes/{id}/link-delivery-notes`).
