# Arquitectura General del Proyecto

**Propósito:** Vista expandida y completa de la estructura del proyecto Nexus Ops RTB, incluyendo todas las carpetas y archivos de configuración.

---

## 1. Diagrama de Servicios (Runtime)

```
                       ┌─────────────────────────────────────┐
                       │       Usuario (Diego / equipo)      │
                       └───────────────┬─────────────────────┘
                                       │  HTTPS
                         ┌─────────────┼─────────────┐
                         │                           │
                  ┌──────▼─────┐             ┌──────▼──────┐
                  │ WiFi local │             │  Cloudflare │
                  │ (LAN)      │             │   Tunnel    │
                  └──────┬─────┘             └──────┬──────┘
                         │                          │
                         └──────────────┬───────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Nginx / Traefik  │
                              │   (reverse proxy) │
                              └─────────┬─────────┘
                                        │
                ┌───────────────────────┼──────────────────────┐
                │                       │                      │
         ┌──────▼────────┐     ┌────────▼─────────┐   ┌────────▼────────┐
         │ Frontend      │     │ Backend API      │   │ n8n (self-host) │
         │ React+Vite    │     │ FastAPI          │   │ Flujos CSV      │
         │ (servido      │     │ (Uvicorn)        │   │                 │
         │  estático)    │     │                  │   │                 │
         └───────────────┘     └────────┬─────────┘   └────────┬────────┘
                                        │                      │
                               ┌────────▼──────────────────────▼─────┐
                               │         Volumen /data/csv           │
                               │  (CSVs refrescados por n8n)         │
                               └─────────────────────────────────────┘
                                        │
                   ┌────────────────────┼────────────────────┐
                   │                    │                    │
           ┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
           │  PostgreSQL    │  │     Redis       │  │  Mail (SMTP)    │
           │ (datos y auth) │  │  (cache/colas)  │  │ (externo/local) │
           └────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 2. Árbol Completo del Proyecto

```
nexus-ops-rtb/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # Punto de entrada FastAPI
│   │   ├── config.py                   # Configuración (carga .env)
│   │   ├── dependencies.py             # Dependencias comunes (auth, db)
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── dashboard.py
│   │   │   ├── ventas.py
│   │   │   ├── inventarios.py
│   │   │   ├── proveedores.py
│   │   │   ├── gastos.py
│   │   │   ├── administracion.py       # Verificador de Fechas Pedidos
│   │   │   ├── reportes.py             # Generación DOCX/PDF
│   │   │   ├── auth.py                 # Login, JWT, refresh
│   │   │   └── health.py               # /health, /metrics
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── venta_model.py
│   │   │   ├── inventario_model.py
│   │   │   ├── proveedor_model.py
│   │   │   ├── gasto_model.py
│   │   │   ├── cotizacion_model.py
│   │   │   ├── factura_model.py
│   │   │   ├── movimiento_model.py
│   │   │   ├── pedido_model.py
│   │   │   ├── no_conforme_model.py
│   │   │   └── user_model.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── venta_schema.py
│   │   │   ├── inventario_schema.py
│   │   │   ├── proveedor_schema.py
│   │   │   ├── gasto_schema.py
│   │   │   ├── reporte_schema.py
│   │   │   └── auth_schema.py
│   │   ├── services/                    # Lógica de negocio
│   │   │   ├── __init__.py
│   │   │   ├── ventas_service.py
│   │   │   ├── inventarios_service.py
│   │   │   ├── proveedores_service.py
│   │   │   ├── gastos_service.py
│   │   │   ├── administracion_service.py
│   │   │   ├── predicciones_service.py  # Series temporales / forecasting
│   │   │   └── reportes_service.py
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   ├── csv_utils.py
│   │   │   ├── email_utils.py
│   │   │   ├── data_fetch.py
│   │   │   ├── docx_generator.py
│   │   │   ├── pdf_generator.py
│   │   │   └── n8n_trigger.py           # Helper para disparar flujos
│   │   └── middleware/
│   │       ├── __init__.py
│   │       ├── cors.py
│   │       ├── logging.py
│   │       └── auth_middleware.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_ventas.py
│   │   ├── test_inventarios.py
│   │   └── conftest.py
│   ├── pyproject.toml                   # Deps con uv/poetry
│   ├── requirements.txt                 # Export de pyproject
│   ├── alembic.ini
│   ├── alembic/                          # Migraciones
│   │   ├── env.py
│   │   └── versions/
│   └── Dockerfile
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── main.tsx                     # Punto de entrada
│   │   ├── App.tsx                      # Router principal
│   │   ├── routes.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx                 # Dashboard general
│   │   │   ├── Ventas.tsx
│   │   │   ├── Inventarios.tsx
│   │   │   ├── Proveedores.tsx
│   │   │   ├── Gastos.tsx
│   │   │   ├── Administracion.tsx
│   │   │   ├── Reportes.tsx
│   │   │   ├── Login.tsx
│   │   │   └── AdminSistema.tsx         # Estado túnel, n8n, logs
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── TunnelStatus.tsx
│   │   │   │   └── AutomationStatus.tsx
│   │   │   ├── dashboards/
│   │   │   │   ├── DashboardGeneral.tsx
│   │   │   │   ├── VentasDashboard.tsx
│   │   │   │   ├── InventariosDashboard.tsx
│   │   │   │   ├── ProveedoresDashboard.tsx
│   │   │   │   ├── GastosDashboard.tsx
│   │   │   │   └── AdministracionDashboard.tsx
│   │   │   ├── charts/
│   │   │   │   ├── BarChart.tsx
│   │   │   │   ├── LineChart.tsx
│   │   │   │   ├── PieChart.tsx
│   │   │   │   ├── StackedBarChart.tsx
│   │   │   │   ├── ScatterChart.tsx
│   │   │   │   ├── Gauge.tsx
│   │   │   │   └── FunnelChart.tsx
│   │   │   ├── common/
│   │   │   │   ├── KpiCard.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   ├── DateRangePicker.tsx
│   │   │   │   ├── MultiSelect.tsx
│   │   │   │   ├── StatusBadge.tsx
│   │   │   │   ├── ReportButton.tsx
│   │   │   │   ├── CsvDownloadButton.tsx
│   │   │   │   └── EmailReportModal.tsx
│   │   │   └── reportes/
│   │   │       └── ReportesGenerados.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useApi.ts
│   │   │   ├── useFilters.ts
│   │   │   └── useAutomation.ts
│   │   ├── services/
│   │   │   ├── api.ts                    # Cliente HTTP (axios/fetch)
│   │   │   ├── authService.ts
│   │   │   ├── ventasService.ts
│   │   │   ├── inventariosService.ts
│   │   │   ├── proveedoresService.ts
│   │   │   ├── gastosService.ts
│   │   │   └── reportesService.ts
│   │   ├── store/                        # Zustand o Context
│   │   │   ├── authStore.ts
│   │   │   └── filtersStore.ts
│   │   ├── utils/
│   │   │   ├── csvUtils.ts
│   │   │   ├── emailUtils.ts
│   │   │   ├── formatters.ts
│   │   │   └── constants.ts
│   │   ├── types/
│   │   │   ├── ventas.ts
│   │   │   ├── inventarios.ts
│   │   │   └── common.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── tests/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── Dockerfile
│
├── database/
│   ├── config.py                         # Conexión SQLAlchemy
│   ├── init/
│   │   └── 01_schema.sql                 # Esquema inicial (si no alembic)
│   ├── seeds/
│   │   └── seed_catalog.sql              # Datos iniciales
│   └── backups/
│       └── .gitkeep                      # Backups locales
│
├── automations/
│   ├── n8n_flows/
│   │   ├── update_ventas_flow.json
│   │   ├── update_inventarios_flow.json
│   │   ├── update_proveedores_flow.json
│   │   ├── update_gastos_flow.json
│   │   ├── update_cotizaciones_flow.json
│   │   ├── update_facturas_flow.json
│   │   ├── update_movimientos_flow.json
│   │   ├── update_solicitudes_flow.json
│   │   ├── update_entradas_flow.json
│   │   ├── update_pedidos_incompletos_flow.json
│   │   └── update_verificador_fechas_flow.json
│   └── README.md                         # Cómo importar flujos a n8n
│
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── default.conf
│   └── cloudflared/
│       └── config.yml
│
├── scripts/
│   ├── setup.sh                           # Instalación inicial
│   ├── start-dev.sh                       # Entorno de desarrollo
│   ├── start-prod.sh                      # Entorno producción
│   ├── stop.sh
│   ├── backup-db.sh                       # Backup de PostgreSQL
│   ├── restore-db.sh
│   ├── sync-repo.sh                       # git pull + rebuild
│   ├── push-repo.sh                       # git add/commit/push
│   ├── update-project.sh                  # Pipeline completo de update
│   ├── deploy.sh                          # Despliegue Docker
│   ├── health-check.sh
│   └── generate-env.sh                    # Genera .env desde .env.example
│
├── data/                                  # Volumen de datos
│   ├── csv/                               # CSVs refrescados por n8n
│   │   ├── ventas.csv
│   │   ├── inventarios.csv
│   │   └── ...
│   ├── reports/                           # Reportes DOCX/PDF generados
│   └── logs/
│
├── docs/
│   ├── API.md                             # Docs API (+ Swagger en /docs)
│   ├── DEPLOYMENT.md
│   ├── N8N_FLOWS.md
│   ├── AUTH.md
│   ├── TROUBLESHOOTING.md
│   └── CHANGELOG.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml                         # Lint + tests
│       ├── build-images.yml               # Build Docker en cada tag
│       └── deploy.yml                     # Deploy a servidor vía SSH
│
├── cloudflare_tunnel.yml                  # Config Cloudflare Tunnel
├── docker-compose.yml                     # Desarrollo
├── docker-compose.prod.yml                # Producción
├── .env.example                           # Plantilla de variables
├── .env                                   # (gitignored)
├── .gitignore
├── .dockerignore
├── Makefile                               # Atajos de comandos
├── pyproject.toml                         # Solo si monorepo con tooling global
├── LICENSE
└── README.md
```

---

## 3. Principios de Arquitectura

1. **Separación backend/frontend:** API RESTful bien definida; el frontend es una SPA independiente servida por Nginx.
2. **Datos desde CSV y DB:** el backend expone endpoints que pueden leer de la base de datos o de los CSVs refrescados por n8n, según el caso.
3. **Automatización desacoplada:** n8n vive en su propio contenedor; la API solo lo dispara vía webhook.
4. **Seguridad por capas:** Cloudflare Tunnel + Nginx + JWT + ACL por red WiFi local.
5. **Despliegue reproducible:** todo vive en Docker; un solo comando levanta el stack entero.
6. **Observabilidad:** healthchecks en cada servicio; logs centralizados; dashboard de estado visible en la UI.
7. **Sincronización del repo:** scripts que estandarizan `pull → build → restart` y `commit → push → tag`.

---

## 4. Flujos de Datos Clave

### 4.1 Actualización de CSV vía n8n
```
[Usuario] → click "Actualizar" en UI
         → POST /api/automation/trigger/{area}
         → backend dispara webhook n8n
         → n8n ejecuta flujo, escribe CSV en /data/csv
         → backend lee CSV actualizado
         → frontend refresca vista
```

### 4.2 Generación de Reporte
```
[Usuario] → selecciona secciones y formato (DOCX/PDF)
         → POST /api/reportes/generar
         → reportes_service renderiza plantilla
         → archivo se guarda en /data/reports
         → frontend recibe URL de descarga
         → (opcional) POST /api/reportes/enviar-correo
```

### 4.3 Login
```
[Usuario] → POST /api/auth/login
         → backend valida contra DB, emite JWT (access + refresh)
         → frontend almacena tokens, añade Authorization header
         → refresh automático antes de expirar
```
