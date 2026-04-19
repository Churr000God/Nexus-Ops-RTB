# AGENTS.md — Guia Maestra de Agentes IA para Nexus Ops RTB

**Ultima actualizacion:** 2026-04-18
**Proyecto:** Nexus Ops RTB — Dashboard operativo con FastAPI + React + Docker

---

## 1. Contexto del Proyecto

Nexus Ops RTB es una plataforma web interna de dashboards operativos para una empresa que gestiona ventas, inventarios, proveedores y gastos. El stack es:

- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL 16
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + Recharts
- **Infraestructura:** Docker Compose (dev/prod) + Nginx + Cloudflare Tunnel + n8n
- **Datos:** CSVs refrescados via n8n + PostgreSQL para persistencia
- **Auth:** JWT con refresh tokens
- **Reportes:** python-docx + WeasyPrint para DOCX/PDF

---

## 2. Reglas Generales para Agentes

### 2.1 Idioma
- El codigo (variables, funciones, clases) se escribe en **ingles**.
- Los comentarios, commits, documentacion y UI se escriben en **espanol**.
- Los nombres de archivos de configuracion y scripts usan convencion en ingles (kebab-case).

### 2.2 Estilo de Codigo

**Python (Backend):**
- Formatter: `ruff format`
- Linter: `ruff check`
- Tipado: estricto con `mypy` (type hints en todas las funciones publicas)
- Imports: agrupados (stdlib, terceros, locales) separados por linea en blanco
- Docstrings: Google style
- Max line length: 100

**TypeScript (Frontend):**
- Formatter: `prettier`
- Linter: `eslint` con config de React + TypeScript
- Componentes: Functional components con hooks (no class components)
- Naming: PascalCase para componentes, camelCase para funciones/variables
- Imports: absolutos desde `src/` (configurar alias `@/`)

### 2.3 Git
- Branch naming: `feature/`, `bugfix/`, `docs/`, `chore/`
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)
- Nunca hacer push directo a `main`
- PRs requieren al menos descripcion clara del cambio

### 2.4 Docker
- Cada cambio en Dockerfile o docker-compose debe probarse con `docker compose build`
- Nunca hardcodear secretos en Dockerfiles o docker-compose
- Usar `.env` para toda configuracion sensible

### 2.5 Base de Datos
- Toda modificacion de esquema pasa por Alembic (nunca SQL directo en produccion)
- Los modelos SQLAlchemy son la fuente de verdad del esquema
- Nombrar tablas en plural y snake_case (ej: `ventas`, `gastos_operativos`)

---

## 3. Estructura de Archivos Clave

```
Archivos que el agente DEBE leer antes de trabajar en un area:

Backend general     → backend/app/main.py, backend/app/config.py
Rutas/endpoints     → backend/app/routers/
Modelos de datos    → backend/app/models/
Logica de negocio   → backend/app/services/
Frontend general    → frontend/src/App.tsx, frontend/src/routes.tsx
Componentes UI      → frontend/src/components/
Paginas             → frontend/src/pages/
Docker              → docker-compose.yml, docker-compose.prod.yml
Scripts             → scripts/
Contexto de negocio → contexto/
Diseno de paginas   → diseno_paginas/
Arquitectura        → estructura_proyecto/
```

---

## 4. Flujo de Trabajo del Agente

### 4.1 Antes de Escribir Codigo
1. Leer el archivo de contexto relevante en `contexto/` para entender la logica de negocio
2. Leer el diseno de la pagina en `diseno_paginas/` si es trabajo de UI
3. Leer la arquitectura en `estructura_proyecto/` si es trabajo estructural
4. Revisar `ERROR_LOG.md` en `.ai-agents/errors/` para evitar errores conocidos
5. Verificar si hay una sesion de aprendizaje relevante en `.ai-agents/learning/`

### 4.2 Durante el Desarrollo
1. Seguir las convenciones de codigo definidas en seccion 2.2
2. Crear tests para toda logica de negocio nueva
3. Documentar decisiones no obvias con comentarios
4. Si encuentras un error nuevo, registrarlo en el ERROR_LOG

### 4.3 Despues de Completar
1. Verificar que `docker compose build` funcione
2. Ejecutar `./scripts/health-check.sh` si modificaste infraestructura
3. Actualizar la sesion de aprendizaje si aplica
4. Hacer commit con mensaje Conventional Commits

---

## 5. Mapa de Dependencias entre Areas

```
ventas.csv ──────► VentasDashboard ──────► /api/ventas/*
                                           └── ventas_service.py
                                               └── venta_model.py
                                                   └── PostgreSQL (ventas)

inventarios.csv ──► InventariosDashboard ──► /api/inventarios/*
                                              └── inventarios_service.py

proveedores.csv ──► ProveedoresDashboard ──► /api/proveedores/*
                                              └── proveedores_service.py

gastos.csv ──────► GastosDashboard ──────► /api/gastos/*
                                            └── gastos_service.py

n8n ──► webhooks ──► actualiza CSVs ──► backend los lee ──► frontend los muestra
```

---

## 6. Patrones a Seguir

### 6.1 Endpoint Backend (Patron estandar)
```python
# backend/app/routers/ventas.py
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_db, get_current_user
from app.services.ventas_service import VentasService
from app.schemas.venta_schema import VentaResponse

router = APIRouter(prefix="/api/ventas", tags=["ventas"])

@router.get("/", response_model=list[VentaResponse])
async def listar_ventas(
    fecha_inicio: str = Query(None),
    fecha_fin: str = Query(None),
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    """Obtener ventas filtradas por rango de fechas."""
    service = VentasService(db)
    return await service.listar(fecha_inicio, fecha_fin)
```

### 6.2 Componente Frontend (Patron estandar)
```tsx
// frontend/src/components/dashboards/VentasDashboard.tsx
import { useState, useEffect } from 'react'
import { useApi } from '@/hooks/useApi'
import { useFilters } from '@/hooks/useFilters'
import { BarChart } from '@/components/charts/BarChart'
import type { Venta } from '@/types/ventas'

export function VentasDashboard() {
  const { filters } = useFilters()
  const { data, loading, error } = useApi<Venta[]>('/api/ventas', { params: filters })

  if (loading) return <div>Cargando...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div className="grid grid-cols-2 gap-4">
      <BarChart data={data} />
    </div>
  )
}
```

---

## 7. Cosas que NO Hacer

- NO crear archivos fuera de la estructura definida
- NO instalar dependencias sin agregarlas a requirements.txt o package.json
- NO modificar docker-compose.yml sin probar que levanta
- NO hacer queries SQL directas en los routers (usar services)
- NO dejar console.log o print statements en codigo final
- NO commitear .env, credentials.json, o cualquier secreto
- NO modificar init.sql para cambios de esquema (usar Alembic)
- NO crear componentes de clase en React (solo funcionales con hooks)

---

## 8. Referencia Rapida de Comandos

```bash
# Desarrollo
make up                          # Levantar stack dev
make down                        # Detener stack
make logs                        # Ver logs
make rebuild                     # Rebuild sin cache

# Deploy
./scripts/deploy.sh dev          # Deploy desarrollo
./scripts/deploy.sh prod         # Deploy produccion
./scripts/deploy.sh prod --force # Forzar rebuild

# Actualizacion
./scripts/update-and-deploy.sh        # Pull + deploy dev
./scripts/update-and-deploy.sh prod   # Pull + deploy prod
./scripts/pull-auto.sh                # Solo pull
./scripts/push-auto-branch.sh "msg"   # Commit + push a rama auto

# Mantenimiento
./scripts/health-check.sh       # Verificar salud
./scripts/backup-db.sh          # Backup BD
./scripts/restore-db.sh <file>  # Restaurar BD
```
