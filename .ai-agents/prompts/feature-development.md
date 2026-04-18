# Prompt: Desarrollo de Feature para Nexus Ops RTB

## Instrucciones
Desarrolla una nueva funcionalidad para Nexus Ops RTB siguiendo este flujo:

## Flujo de Desarrollo

### Fase 1: Entender
1. Leer el archivo de contexto relevante en `contexto/`
2. Leer el diseno de pagina en `diseno_paginas/` si aplica
3. Revisar `estructura_proyecto/` para entender donde va el codigo
4. Consultar `AGENTS.md` para convenciones

### Fase 2: Disenar
1. Definir los endpoints necesarios (path, metodo, params, response)
2. Definir el modelo de datos si es nuevo
3. Definir los componentes frontend necesarios
4. Identificar dependencias con otros modulos

### Fase 3: Implementar (orden)
1. **Modelo** (`backend/app/models/`) — si hay tabla nueva
2. **Migracion** (`alembic revision --autogenerate`) — si hay cambio de esquema
3. **Schema** (`backend/app/schemas/`) — validacion de datos
4. **Service** (`backend/app/services/`) — logica de negocio
5. **Router** (`backend/app/routers/`) — endpoints
6. **Registrar router** en `backend/app/main.py`
7. **Types** (`frontend/src/types/`) — tipos TypeScript
8. **Service frontend** (`frontend/src/services/`) — llamadas a API
9. **Componente** (`frontend/src/components/`) — UI
10. **Pagina** (`frontend/src/pages/`) — si es pagina nueva
11. **Ruta** (`frontend/src/routes.tsx`) — si es pagina nueva

### Fase 4: Verificar
1. `docker compose build` — verificar que compila
2. Probar endpoints con curl o Swagger (/docs)
3. Probar UI en el navegador
4. Ejecutar tests si existen

### Fase 5: Documentar
1. Actualizar SESSION_LOG si aplica
2. Registrar errores en ERROR_LOG si hubo
3. Commit con mensaje Conventional Commits
