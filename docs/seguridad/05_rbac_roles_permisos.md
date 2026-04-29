# RBAC — Roles y Permisos

---

## Sistema dual de roles

El sistema convive con **dos mecanismos** de roles distintos. Es importante no confundirlos.

| Mecanismo | Campo | Valores | Controla |
|-----------|-------|---------|----------|
| **Legacy** | `users.role` | `admin` / `operativo` / `lectura` | Quién puede administrar usuarios y realizar operaciones de admin del sistema |
| **RBAC** | tablas `roles` + `user_roles` | ADMIN, SALES, PURCHASING, WAREHOUSE, ACCOUNTING, READ_ONLY, DRIVER | Permisos operacionales en el JWT |

El rol legacy `admin` es necesario para acceder al panel `/admin/usuarios` y cambiar contraseñas de otros usuarios. El RBAC operacional controla todo lo demás (CFDI, compras, inventario, etc.).

Un usuario puede tener `users.role = "operativo"` (no puede administrar usuarios) pero tener el rol RBAC `ACCOUNTING` (puede emitir CFDIs).

---

## Roles RBAC definidos

### ADMIN (role_id = 1)

Acceso total al sistema. Recibe todos los permisos definidos en el catálogo mediante:

```sql
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ADMIN';
```

**64 permisos** (todos los del catálogo). El rol ADMIN está protegido: no se pueden modificar sus permisos desde el panel de admin (`RoleProtectedError` → 403).

### SALES (role_id = 2) — Ventas

**21 permisos**: gestión de clientes, catálogo de productos, ciclo completo de cotizaciones (ver/crear/editar/enviar/aprobar/cancelar), vista de pedidos, creación de solicitudes de compra, consulta de inventario, reportes de ventas e inventario.

### PURCHASING (role_id = 3) — Compras

**22 permisos**: gestión de proveedores, catálogo, ciclo completo de compras (solicitudes → OC → recepción → factura proveedor), consulta de pedidos e inventario, reporte de inventario.

### WAREHOUSE (role_id = 4) — Almacén

**20 permisos**: catálogo, recepciones, no conformidades, ajustes de inventario, empacado y envío de pedidos, reporte de inventario.

### ACCOUNTING (role_id = 5) — Contabilidad

**22 permisos**: vistas de clientes/proveedores/catálogo/cotizaciones/pedidos, facturas de proveedor, ciclo CFDI completo (emitir/cancelar/nota de crédito), registro de pagos, gastos, reportes (ventas + inventario + financiero).

### READ_ONLY (role_id = 6) — Solo lectura

**13 permisos**: únicamente permisos `.view` y `report.*` — no puede crear ni modificar ningún registro.

### DRIVER (role_id = 8) — Conductor

**2 permisos**: `order.ship` y `order.deliver`. Rol mínimo para que conductores actualicen el estado de entregas.

---

## Catálogo de permisos (70 permisos)

### Administración
| Código | Descripción |
|--------|-------------|
| `user.view` | Ver lista de usuarios |
| `user.manage` | Crear, editar, desactivar usuarios |
| `role.manage` | Crear roles y asignar permisos |

### Clientes
| Código | Descripción |
|--------|-------------|
| `customer.view` | Ver clientes y sus datos |
| `customer.manage` | Crear, editar, desactivar clientes |

### Proveedores
| Código | Descripción |
|--------|-------------|
| `supplier.view` | Ver proveedores |
| `supplier.manage` | Crear, editar, desactivar proveedores |

### Productos y precios
| Código | Descripción |
|--------|-------------|
| `product.view` | Ver catálogo de productos |
| `product.manage` | Crear, editar productos y configuraciones |
| `product.price.manage` | Cambiar precios de venta |

### Cotizaciones
| Código | Descripción |
|--------|-------------|
| `quote.view` | Ver cotizaciones |
| `quote.create` | Crear cotizaciones nuevas |
| `quote.edit` | Editar cotización en estado DRAFT |
| `quote.send` | Enviar cotización al cliente |
| `quote.approve` | Aprobar cotización |
| `quote.cancel` | Cancelar cotización |

### Pedidos
| Código | Descripción |
|--------|-------------|
| `order.view` | Ver pedidos |
| `order.pack` | Empacar pedido |
| `order.ship` | Marcar pedido como enviado |
| `order.deliver` | Confirmar entrega |
| `order.cancel` | Cancelar pedido |

### Compras
| Código | Descripción |
|--------|-------------|
| `purchase_request.create` | Crear solicitud de material |
| `purchase_request.approve` | Aprobar solicitud de material |
| `purchase_order.create` | Crear OC al proveedor |
| `purchase_order.send` | Enviar OC |
| `purchase_order.cancel` | Cancelar OC |

### Recepciones
| Código | Descripción |
|--------|-------------|
| `goods_receipt.create` | Registrar entrada de mercancía |
| `goods_receipt.validate` | Validar físicamente la mercancía recibida |

### No conformidades
| Código | Descripción |
|--------|-------------|
| `non_conformity.create` | Levantar no conforme |
| `non_conformity.resolve` | Resolver no conforme |

### Facturas proveedor
| Código | Descripción |
|--------|-------------|
| `supplier_invoice.capture` | Capturar factura de proveedor |
| `supplier_invoice.pay` | Marcar factura de proveedor como pagada |

### Inventario
| Código | Descripción |
|--------|-------------|
| `inventory.view` | Consultar stock |
| `inventory.adjust` | Ajuste manual de inventario |

### CFDI / Facturación
| Código | Descripción |
|--------|-------------|
| `cfdi.issue` | Emitir CFDI tipo I al cliente |
| `cfdi.cancel` | Cancelar CFDI ante el SAT |
| `cfdi.credit_note` | Emitir nota de crédito (CFDI tipo E) |

### Cobranza y pagos
| Código | Descripción |
|--------|-------------|
| `payment.register` | Registrar pago recibido del cliente |
| `expense.create` | Capturar gasto operativo |

### Reportes y auditoría
| Código | Descripción |
|--------|-------------|
| `report.sales` | Ver reporte de ventas |
| `report.inventory` | Ver reporte de inventario y KPIs |
| `report.financial` | Ver reportes financieros |
| `audit.view` | Ver bitácora de auditoría |

---

## JWT con permisos

Al crear un access token, el backend consulta todos los permisos del usuario y los embebe en el payload:

```python
async def get_user_permissions(self, user_id: UUID) -> list[str]:
    result = await self.db.scalars(
        select(Permission.code)
        .select_from(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.role_id == UserRole.role_id)
        .join(RolePermission, RolePermission.role_id == Role.role_id)
        .join(Permission, Permission.permission_id == RolePermission.permission_id)
        .where(User.id == user_id)
        .distinct()
        .order_by(Permission.code)
    )
    return list(result.all())
```

Los permisos se deduplicam (`DISTINCT`): si un usuario tiene SALES y ACCOUNTING, los permisos comunes (`customer.view`, etc.) aparecen una sola vez.

---

## Guards en el backend

### `require_permission(permission: str)`

Decorador-factory que retorna una dependency de FastAPI:

```python
def require_permission(permission: str):
    async def dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
    ) -> User:
        token_payload: dict = request.state.token_payload or {}
        perms: list[str] = token_payload.get("permissions", [])
        if permission not in perms:
            raise HTTPException(403, f"Permiso requerido: {permission}")
        return current_user
    return dependency
```

**Uso en endpoints:**
```python
@router.get("/roles", response_model=list[RoleWithPermissions])
async def list_roles(
    _: User = Depends(require_permission("role.manage")),
    db: AsyncSession = Depends(get_db),
) -> list[RoleWithPermissions]:
    ...
```

### `require_roles(*roles: str)` (legacy)

Guard heredado basado en `users.role`. Se usa únicamente para el endpoint de cambio de contraseña del panel admin:

```python
@router.patch("/{user_id}/password")
async def change_user_password(
    user_id: UUID,
    payload: ChangePasswordRequest,
    current_user: User = Depends(require_roles("admin")),  # ← solo admins legacy
    ...
):
```

---

## Administración de roles (panel)

### Listar roles con sus permisos

```
GET /api/admin/roles
Authorization: Bearer <token con role.manage>
← [
    {
      "role_id": 2,
      "code": "SALES",
      "name": "Ventas",
      "description": "...",
      "permissions": [
        { "permission_id": 4, "code": "customer.view", "description": "..." },
        ...
      ]
    },
    ...
  ]
```

### Crear nuevo rol

```
POST /api/admin/roles
{ "code": "LOGISTICS", "name": "Logística", "permission_codes": ["order.ship", "order.deliver"] }
```

El `code` se normaliza a MAYÚSCULAS. El código `ADMIN` está reservado.

### Actualizar permisos de un rol

```
PUT /api/admin/roles/{role_id}/permissions
{ "permission_codes": ["order.ship", "order.deliver", "inventory.view"] }
```

Reemplaza completamente los permisos del rol. Bloqueado para rol ADMIN (403).

### Listar todos los permisos disponibles

```
GET /api/admin/permissions
← [{ "permission_id": 1, "code": "user.view", "description": "..." }, ...]
```
