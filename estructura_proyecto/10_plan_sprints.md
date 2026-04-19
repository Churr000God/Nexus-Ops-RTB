# Plan de Implementacion por Sprints — Nexus Ops RTB

**Fecha:** 2026-04-18
**Duracion por sprint:** 2 semanas
**Total estimado:** 8 sprints (~16 semanas)
**Equipo:** Diego + agentes IA (Claude)

---

## Vision General

```
Sprint 0  ██████████  Planificacion y estructura         ✅ COMPLETADO
Sprint 1  ░░░░░░░░░░  Cimientos: entorno, BD, auth
Sprint 2  ░░░░░░░░░░  Dashboard general + ventas
Sprint 3  ░░░░░░░░░░  Inventarios + proveedores
Sprint 4  ░░░░░░░░░░  Gastos + administracion
Sprint 5  ░░░░░░░░░░  n8n + automatizacion CSV
Sprint 6  ░░░░░░░░░░  Reportes DOCX/PDF + correo
Sprint 7  ░░░░░░░░░░  Seguridad, Cloudflare, prod
Sprint 8  ░░░░░░░░░░  Pulido, testing, deploy final
```

---

## Sprint 0 — Planificacion y Estructura (COMPLETADO)

**Objetivo:** Definir arquitectura, estructura de carpetas, documentacion base y herramientas.

### Entregables
- [x] Documentacion de contexto de negocio (`contexto/`)
- [x] Diseno de paginas (`diseno_paginas/`)
- [x] Arquitectura del proyecto (`estructura_proyecto/`)
- [x] Docker Compose dev + prod
- [x] Dockerfiles base (backend + frontend)
- [x] Scripts de git (pull/push)
- [x] .env.example con todas las variables
- [x] Makefile basico
- [x] Carpeta .ai-agents/ con AGENTS.md
- [x] Sistema de learning sessions y error log
- [x] Scripts de deploy automatico
- [x] Plan de sprints (este documento)

---

## Sprint 1 — Cimientos: Entorno, Base de Datos y Auth

**Objetivo:** Tener un entorno de desarrollo funcional con base de datos, migraciones y autenticacion basica.

**Duracion:** 2 semanas

### Backend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Configurar Alembic para migraciones | `backend/alembic.ini`, `backend/alembic/env.py` | Alta |
| Crear modelo User con campos auth | `backend/app/models/user_model.py` | Alta |
| Crear schemas de auth | `backend/app/schemas/auth_schema.py` | Alta |
| Implementar endpoints auth (login, register, refresh) | `backend/app/routers/auth.py` | Alta |
| Crear middleware de auth (JWT) | `backend/app/middleware/auth_middleware.py` | Alta |
| Crear dependency `get_current_user` | `backend/app/dependencies.py` | Alta |
| Configurar CORS middleware | `backend/app/middleware/cors.py` | Media |
| Configurar logging con Loguru | `backend/app/middleware/logging.py` | Media |
| Primera migracion: tablas users | `backend/alembic/versions/` | Alta |
| Agregar stage `prod` al Dockerfile | `backend/Dockerfile` | Media |

### Frontend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Instalar TailwindCSS + postcss | `tailwind.config.js`, `postcss.config.js` | Alta |
| Instalar React Router | `package.json` | Alta |
| Instalar Recharts | `package.json` | Alta |
| Instalar Zustand (state management) | `package.json` | Alta |
| Instalar shadcn/ui (componentes base) | `package.json` | Media |
| Crear estructura de carpetas (pages, components, etc.) | `frontend/src/` | Alta |
| Crear layout base (Sidebar + Header) | `components/layout/` | Alta |
| Crear pagina Login | `pages/Login.tsx` | Alta |
| Crear hook useAuth | `hooks/useAuth.ts` | Alta |
| Crear servicio authService | `services/authService.ts` | Alta |
| Configurar rutas con React Router | `routes.tsx` | Alta |
| Configurar alias `@/` en Vite | `vite.config.ts`, `tsconfig.json` | Media |

### Infraestructura

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear .dockerignore para ambos | `.dockerignore` | Media |
| Mejorar .gitignore | `.gitignore` | Baja |
| Mejorar Makefile (targets test, lint) | `Makefile` | Baja |
| CI basico con GitHub Actions | `.github/workflows/ci.yml` | Baja |

### Criterios de Aceptacion
- [ ] `docker compose up` levanta todo sin errores
- [ ] POST `/api/auth/login` devuelve JWT
- [ ] POST `/api/auth/register` crea usuario
- [ ] Frontend muestra pagina de login funcional
- [ ] Alembic puede crear y revertir migraciones
- [ ] TailwindCSS funciona en el frontend

---

## Sprint 2 — Dashboard General + Ventas

**Objetivo:** Primer dashboard funcional con datos reales de ventas.

**Duracion:** 2 semanas

### Backend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear modelos de ventas | `models/venta_model.py`, `cotizacion_model.py`, `factura_model.py` | Alta |
| Migracion: tablas ventas | `alembic/versions/` | Alta |
| Crear schemas de ventas | `schemas/venta_schema.py` | Alta |
| Crear VentasService | `services/ventas_service.py` | Alta |
| Crear endpoints ventas | `routers/ventas.py` | Alta |
| Crear csv_utils (leer/parsear CSV) | `utils/csv_utils.py` | Alta |
| Crear data_fetch helper | `utils/data_fetch.py` | Media |
| Crear endpoint dashboard general | `routers/dashboard.py` | Alta |
| Endpoint: ventas por mes | `routers/ventas.py` | Alta |
| Endpoint: ventas por cliente | `routers/ventas.py` | Alta |
| Endpoint: margen bruto por producto | `routers/ventas.py` | Alta |
| Endpoint: ventas aprobadas vs canceladas | `routers/ventas.py` | Media |

### Frontend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear componente KpiCard | `components/common/KpiCard.tsx` | Alta |
| Crear componente DataTable | `components/common/DataTable.tsx` | Alta |
| Crear componente DateRangePicker | `components/common/DateRangePicker.tsx` | Alta |
| Crear componente BarChart (wrapper Recharts) | `components/charts/BarChart.tsx` | Alta |
| Crear componente LineChart | `components/charts/LineChart.tsx` | Alta |
| Crear componente PieChart | `components/charts/PieChart.tsx` | Alta |
| Crear hook useApi (fetch generico) | `hooks/useApi.ts` | Alta |
| Crear hook useFilters | `hooks/useFilters.ts` | Alta |
| Crear servicio ventasService | `services/ventasService.ts` | Alta |
| Crear DashboardGeneral | `components/dashboards/DashboardGeneral.tsx` | Alta |
| Crear VentasDashboard | `components/dashboards/VentasDashboard.tsx` | Alta |
| Crear pagina Home | `pages/Home.tsx` | Alta |
| Crear pagina Ventas | `pages/Ventas.tsx` | Alta |
| Crear types para ventas | `types/ventas.ts` | Alta |

### Criterios de Aceptacion
- [ ] Dashboard general muestra KPIs y graficas con datos reales
- [ ] Pagina de ventas muestra todas las graficas definidas en el diseno
- [ ] Filtros de fecha funcionan y actualizan las graficas
- [ ] Los datos se cargan desde CSV o BD correctamente
- [ ] Las graficas son interactivas (hover, click para detalle)

---

## Sprint 3 — Inventarios + Proveedores

**Objetivo:** Dashboards funcionales de inventarios y proveedores.

**Duracion:** 2 semanas

### Backend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear modelos inventarios | `models/inventario_model.py`, `movimiento_model.py` | Alta |
| Crear modelos proveedores | `models/proveedor_model.py` | Alta |
| Migraciones correspondientes | `alembic/versions/` | Alta |
| InventariosService | `services/inventarios_service.py` | Alta |
| ProveedoresService | `services/proveedores_service.py` | Alta |
| Endpoints inventarios | `routers/inventarios.py` | Alta |
| Endpoints proveedores | `routers/proveedores.py` | Alta |
| Stock real vs teorico | `services/inventarios_service.py` | Alta |
| Clasificacion ABC de productos | `services/inventarios_service.py` | Media |
| Dias sin movimiento | `services/inventarios_service.py` | Media |
| Compras por proveedor | `services/proveedores_service.py` | Alta |
| Tiempo promedio de entrega | `services/proveedores_service.py` | Media |
| Eficiencia de proveedores | `services/proveedores_service.py` | Media |

### Frontend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear StackedBarChart | `components/charts/StackedBarChart.tsx` | Alta |
| Crear componente StatusBadge | `components/common/StatusBadge.tsx` | Media |
| Crear InventariosDashboard | `components/dashboards/InventariosDashboard.tsx` | Alta |
| Crear ProveedoresDashboard | `components/dashboards/ProveedoresDashboard.tsx` | Alta |
| Crear pagina Inventarios | `pages/Inventarios.tsx` | Alta |
| Crear pagina Proveedores | `pages/Proveedores.tsx` | Alta |
| Crear types para inventarios y proveedores | `types/` | Alta |
| Crear servicios frontend | `services/` | Alta |

### Criterios de Aceptacion
- [ ] Pagina inventarios muestra stock real vs teorico
- [ ] Clasificacion ABC visible y funcional
- [ ] Pagina proveedores muestra compras y eficiencia
- [ ] Filtros por fecha y categoria funcionan en ambas paginas
- [ ] Graficas de barras apiladas para comparaciones

---

## Sprint 4 — Gastos + Administracion

**Objetivo:** Dashboards de gastos operativos y herramientas de administracion.

**Duracion:** 2 semanas

### Backend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear modelos gastos | `models/gasto_model.py` | Alta |
| Crear modelos administracion | `models/pedido_model.py`, `no_conforme_model.py` | Alta |
| GastosService | `services/gastos_service.py` | Alta |
| AdministracionService | `services/administracion_service.py` | Alta |
| Endpoints gastos | `routers/gastos.py` | Alta |
| Endpoints administracion | `routers/administracion.py` | Alta |
| Gastos por categoria | `services/gastos_service.py` | Alta |
| Gastos deducibles | `services/gastos_service.py` | Media |
| Verificador de fechas de pedidos | `services/administracion_service.py` | Alta |

### Frontend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear GastosDashboard | `components/dashboards/GastosDashboard.tsx` | Alta |
| Crear AdministracionDashboard | `components/dashboards/AdministracionDashboard.tsx` | Alta |
| Crear pagina Gastos | `pages/Gastos.tsx` | Alta |
| Crear pagina Administracion | `pages/Administracion.tsx` | Alta |
| Crear MultiSelect para filtros de categoria | `components/common/MultiSelect.tsx` | Media |

### Criterios de Aceptacion
- [ ] Gastos por categoria con grafica circular
- [ ] Gastos por proveedor visible
- [ ] Gastos deducibles vs no deducibles
- [ ] Verificador de fechas de pedidos funcional
- [ ] Todas las paginas anteriores siguen funcionando

---

## Sprint 5 — n8n + Automatizacion de CSV

**Objetivo:** Integrar n8n para actualizar CSVs automaticamente y mostrar estado en la UI.

**Duracion:** 2 semanas

### Backend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear n8n_trigger helper | `utils/n8n_trigger.py` | Alta |
| Endpoint para disparar actualizacion | `routers/dashboard.py` | Alta |
| Endpoint para estado de automatizacion | `routers/dashboard.py` | Alta |
| Webhook receptor de n8n (notifica completado) | `routers/dashboard.py` | Alta |
| Registrar logs de actualizacion en BD/archivo | `utils/` | Media |

### n8n Flows

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Flujo: actualizar ventas CSV | `automations/n8n_flows/update_ventas_flow.json` | Alta |
| Flujo: actualizar inventarios CSV | `automations/n8n_flows/update_inventarios_flow.json` | Alta |
| Flujo: actualizar proveedores CSV | `automations/n8n_flows/update_proveedores_flow.json` | Alta |
| Flujo: actualizar gastos CSV | `automations/n8n_flows/update_gastos_flow.json` | Alta |
| Documentar flujos | `automations/README.md` | Media |

### Frontend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear hook useAutomation | `hooks/useAutomation.ts` | Alta |
| Crear componente AutomationStatus | `components/layout/AutomationStatus.tsx` | Alta |
| Boton "Actualizar" en cada dashboard | Todos los dashboards | Alta |
| Indicador de estado (completado/en proceso/error) | `components/common/StatusBadge.tsx` | Alta |

### Criterios de Aceptacion
- [ ] Click en "Actualizar" dispara flujo n8n
- [ ] El estado se muestra en la UI (en proceso, completado, error)
- [ ] Los CSVs se actualizan y los dashboards reflejan los nuevos datos
- [ ] n8n tiene los 4 flujos configurados y funcionando
- [ ] Hay logs de cada actualizacion

---

## Sprint 6 — Reportes DOCX/PDF + Correo

**Objetivo:** Generar reportes descargables y enviarlos por correo.

**Duracion:** 2 semanas

### Backend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Instalar python-docx y WeasyPrint | `requirements.txt` | Alta |
| Crear docx_generator | `utils/docx_generator.py` | Alta |
| Crear pdf_generator | `utils/pdf_generator.py` | Alta |
| Crear ReportesService | `services/reportes_service.py` | Alta |
| Endpoints: generar reporte | `routers/reportes.py` | Alta |
| Endpoints: listar reportes generados | `routers/reportes.py` | Alta |
| Endpoints: descargar reporte | `routers/reportes.py` | Alta |
| Configurar email_utils (SMTP) | `utils/email_utils.py` | Alta |
| Endpoint: enviar reporte por correo | `routers/reportes.py` | Alta |
| Crear schemas de reportes | `schemas/reporte_schema.py` | Alta |

### Frontend

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Crear componente ReportButton | `components/common/ReportButton.tsx` | Alta |
| Crear componente CsvDownloadButton | `components/common/CsvDownloadButton.tsx` | Media |
| Crear EmailReportModal | `components/common/EmailReportModal.tsx` | Alta |
| Crear ReportesGenerados | `components/reportes/ReportesGenerados.tsx` | Alta |
| Crear pagina Reportes | `pages/Reportes.tsx` | Alta |
| Integrar boton de reporte en cada dashboard | Todos los dashboards | Media |

### Criterios de Aceptacion
- [ ] Se puede generar un reporte DOCX con datos de ventas
- [ ] Se puede generar un reporte PDF
- [ ] Los reportes incluyen tablas, graficas y fecha/periodo
- [ ] Se puede enviar un reporte por correo desde la plataforma
- [ ] La pagina de reportes lista todos los generados
- [ ] Se pueden descargar reportes generados anteriormente

---

## Sprint 7 — Seguridad, Cloudflare Tunnel y Produccion

**Objetivo:** Hardening de seguridad, configuracion del tunel Cloudflare y preparacion para produccion.

**Duracion:** 2 semanas

### Seguridad

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Rate limiting en Nginx | `docker/nginx/default.prod.conf` | Alta |
| Configurar HTTPS con certificados | `docker/nginx/certs/` | Alta |
| Validar JWT en todos los endpoints protegidos | `middleware/auth_middleware.py` | Alta |
| Refresh token rotation | `routers/auth.py` | Alta |
| Logout (invalidar tokens) | `routers/auth.py` | Media |
| ACL basico (roles admin/viewer) | `models/user_model.py`, `dependencies.py` | Media |
| Headers de seguridad (HSTS, CSP, etc.) | `docker/nginx/` | Media |

### Cloudflare Tunnel

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Configurar tunel con credenciales | `docker/cloudflared/config.yml` | Alta |
| Probar acceso remoto | — | Alta |
| Mostrar estado del tunel en UI | `components/layout/TunnelStatus.tsx` | Media |
| Boton copiar enlace del tunel | `pages/AdminSistema.tsx` | Baja |

### Produccion

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Agregar target prod al Dockerfile backend | `backend/Dockerfile` | Alta |
| Optimizar Nginx para produccion | `docker/nginx/default.prod.conf` | Alta |
| Configurar workers Uvicorn | `docker-compose.prod.yml` | Media |
| Crear pagina AdminSistema | `pages/AdminSistema.tsx` | Media |
| Health check endpoint con metricas | `routers/health.py` | Media |

### Criterios de Aceptacion
- [ ] `docker compose -f docker-compose.yml -f docker-compose.prod.yml up` funciona
- [ ] Acceso remoto via Cloudflare Tunnel verificado
- [ ] JWT valido requerido para todos los endpoints excepto /health y /auth
- [ ] Rate limiting activo en produccion
- [ ] Pagina AdminSistema muestra estado del tunel

---

## Sprint 8 — Pulido, Testing y Deploy Final

**Objetivo:** Testing completo, predicciones, optimizacion y deploy definitivo.

**Duracion:** 2 semanas

### Predicciones e Inteligencia

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| PrediccionesService (series temporales) | `services/predicciones_service.py` | Alta |
| Endpoint: proyeccion de ventas | `routers/ventas.py` | Alta |
| Endpoint: proyeccion margen bruto | `routers/ventas.py` | Media |
| Mostrar proyecciones en dashboards | Frontend | Alta |

### Testing

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Tests unitarios para services | `backend/tests/` | Alta |
| Tests de integracion para endpoints | `backend/tests/` | Alta |
| Tests E2E basicos (si hay tiempo) | `frontend/tests/` | Baja |
| Conftest con fixtures de BD de prueba | `backend/tests/conftest.py` | Alta |

### Optimizacion

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| Cache con Redis para queries frecuentes | `services/`, `dependencies.py` | Media |
| Paginacion en todos los endpoints de lista | `routers/` | Alta |
| Lazy loading de componentes en frontend | `routes.tsx` | Media |
| Optimizar queries SQL (indices, joins) | `models/` | Media |

### Deploy Final

| Tarea | Archivo(s) | Prioridad |
|-------|-----------|-----------|
| GitHub Actions: CI completo | `.github/workflows/ci.yml` | Media |
| GitHub Actions: deploy automatico | `.github/workflows/deploy.yml` | Media |
| Documentar proceso de deploy | `docs/DEPLOYMENT.md` | Media |
| Pruebas de carga basicas | — | Baja |
| Seed data para demo | `database/seeds/` | Media |

### Criterios de Aceptacion
- [ ] Coverage de tests > 60% en servicios del backend
- [ ] Todos los endpoints paginados
- [ ] Predicciones de ventas visibles en dashboard
- [ ] CI pasa en GitHub Actions
- [ ] Deploy automatico funcionando
- [ ] Documentacion de deploy actualizada

---

## Dependencias entre Sprints

```
Sprint 0 ──► Sprint 1 (estructura → cimientos)
Sprint 1 ──► Sprint 2 (auth + BD → datos de ventas)
Sprint 1 ──► Sprint 3 (auth + BD → inventarios/proveedores)
Sprint 2 ──► Sprint 3 (componentes charts reutilizables)
Sprint 3 ──► Sprint 4 (patron ya establecido)
Sprint 2-4 ─► Sprint 5 (todos los dashboards → automatizacion)
Sprint 2-4 ─► Sprint 6 (datos disponibles → reportes)
Sprint 5-6 ─► Sprint 7 (todo funcional → seguridad)
Sprint 7 ──► Sprint 8 (produccion → testing + deploy)
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| n8n no conecta con fuentes de datos | Alta | Alto | Tener CSVs de ejemplo para desarrollo sin n8n |
| WeasyPrint problemas en Docker | Media | Medio | Fallback a ReportLab para PDFs |
| Cloudflare Tunnel requiere dominio | Baja | Medio | Puede funcionar solo en red local como MVP |
| Dependencias de frontend incompatibles | Baja | Bajo | Lock versions en package.json |
| Migraciones Alembic con conflictos | Media | Medio | Siempre hacer backup antes de migrar |

---

## Notas para el Agente IA

1. **Cada sprint empieza leyendo** el contexto en `contexto/` y el diseno en `diseno_paginas/` del area correspondiente.
2. **Registrar errores** en `.ai-agents/errors/ERROR_LOG.md` durante el desarrollo.
3. **Crear sesion de aprendizaje** al final de cada sprint en `.ai-agents/learning/sessions/`.
4. **No saltar sprints**: cada sprint construye sobre el anterior.
5. **Priorizar "funciona en Docker"** sobre "codigo perfecto". Iterar despues.
6. **Los CSVs de ejemplo** se crean en Sprint 2 para poder desarrollar sin n8n real hasta Sprint 5.
