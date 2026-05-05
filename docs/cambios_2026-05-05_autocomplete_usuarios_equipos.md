# Autocomplete de usuarios en asignación de equipos (2026-05-05)

Mejora del modal `AssignAssetModal` para reemplazar el `<select>` nativo de usuarios por un campo de búsqueda con autocomplete. Al escribir el nombre o email de un usuario, el sistema arroja resultados filtrados en tiempo real vía endpoint dedicado.

---

## Backend

### Nuevo endpoint

| Method | Path | Descripción |
|---|---|---|
| GET | `/api/usuarios/search?q={query}&limit=10` | Busca usuarios activos por nombre o email (case-insensitive) |

**Query params:**
- `q` (requerido, `min_length=1`): término de búsqueda
- `limit` (opcional, default `10`, max `50`): cantidad máxima de resultados

**Permiso requerido:** `user.view`

**Response:** `list[UserResponse]` — incluye roles resueltos por usuario.

### Service

`backend/app/services/user_service.py`:
- Nuevo método `search_users(query: str, limit: int = 10) -> list[User]`
- Filtra `is_active = True`
- Busca con `ilike` sobre `full_name` y `email`
- Ordena por `full_name`

### Router

`backend/app/routers/usuarios.py`:
- Registrado endpoint `GET /api/usuarios/search` antes de `POST /api/usuarios` para evitar que FastAPI interprete `"search"` como un `user_id`

---

## Frontend

### Service

`frontend/src/services/adminService.ts`:
- Nuevo método `searchUsers(token, query, signal?)`
- Construye query string `?q={query}&limit=10`

### Componente

`frontend/src/components/assets/AssignAssetModal.tsx`:
- **Eliminado:** carga completa de usuarios vía `useApi` + `adminService.listUsers`
- **Eliminado:** `<select>` nativo
- **Agregados estados:** `search`, `results`, `searching`, `selectedUser`
- **Input de búsqueda:** con ícono `Search`, placeholder "Buscar usuario por nombre o email…"
- **Debounce:** 300 ms antes de llamar al API
- **Dropdown de resultados:** fondo sólido `bg-background` (evita transparencia), lista nombre + email por usuario
- **Selección:** al elegir un usuario se muestra una tarjeta compacta con nombre/email y botón `X` para quitar la selección
- **Desasignar:** quitar la selección vuelve el estado a `"__none__"` (sin asignar)

### Patrón visual

Reutiliza el mismo patrón de dropdown ya establecido en:
- `InstallComponentModal.tsx` (búsqueda de productos de catálogo)
- `AssetFormModal.tsx` (búsqueda de activo padre)

---

## Archivos modificados

| Archivo | Tipo |
|---|---|
| `backend/app/services/user_service.py` | Modificado |
| `backend/app/routers/usuarios.py` | Modificado |
| `frontend/src/services/adminService.ts` | Modificado |
| `frontend/src/components/assets/AssignAssetModal.tsx` | Modificado |
| `docs/cambios_2026-05-05_autocomplete_usuarios_equipos.md` | Nuevo (este archivo) |

---

## Verificación

1. `python -m py_compile` sobre `user_service.py` y `usuarios.py` — ✅ sin errores
2. `npx tsc --noEmit` sobre el frontend — ✅ sin errores
3. Endpoint disponible en Swagger (`/docs`) bajo tag **usuarios**

---

## Notas

- No requiere migración de base de datos; reutiliza la tabla `users` existente.
- El endpoint solo retorna usuarios activos (`is_active = true`).
- La búsqueda es case-insensitive gracias a `ilike` de PostgreSQL.
