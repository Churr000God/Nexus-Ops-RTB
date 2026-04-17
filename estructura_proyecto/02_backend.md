# Backend — FastAPI

**Propósito:** Especificación del servicio backend que expone la API REST, integra con n8n, genera reportes, envía correos y gestiona autenticación.

---

## 1. Stack y Dependencias Principales

| Paquete | Propósito |
|---------|-----------|
| `fastapi` | Framework web asíncrono |
| `uvicorn[standard]` | Servidor ASGI |
| `pydantic` | Validación y settings |
| `sqlalchemy` | ORM |
| `alembic` | Migraciones de DB |
| `psycopg[binary]` | Driver PostgreSQL |
| `redis` | Cache y colas |
| `python-jose[cryptography]` | JWT |
| `passlib[bcrypt]` | Hash de contraseñas |
| `python-multipart` | File uploads |
| `pandas` | Procesamiento de CSV y series temporales |
| `statsmodels` / `prophet` | Modelos predictivos |
| `python-docx` | Generación DOCX |
| `weasyprint` o `reportlab` | Generación PDF |
| `aiosmtplib` | Envío de correo |
| `jinja2` | Plantillas de reportes |
| `httpx` | Disparo de webhooks a n8n |
| `loguru` | Logging |
| `pytest`, `pytest-asyncio`, `httpx[test]` | Tests |
| `ruff`, `mypy` | Linter y tipado |

---

## 2. Endpoints Principales (API REST)

### 2.1 Dashboard General (`/api/dashboard`)
- `GET /kpis` — KPIs globales filtrables por rango.
- `GET /ventas-mes` — Barras: real vs. proyectado.
- `GET /tendencia-ventas` — Líneas históricas.
- `GET /distribucion-productos` — Pie.
- `GET /demanda-vs-ventas` — Barras apiladas.
- `GET /estado-sistema` — Estado de túnel y flujos n8n.

### 2.2 Ventas (`/api/ventas`)
- `GET /por-cliente` — Ventas agregadas por cliente.
- `GET /por-producto` — Ventas y margen por producto.
- `GET /aprobadas-vs-canceladas` — Historia + proyección.
- `GET /margen-por-producto`
- `GET /demanda-historica`
- `GET /tiempo-aprobacion`
- `GET /tiempo-pago`
- `GET /descuentos`
- `GET /locales-vs-foraneos`
- `GET /ventas-mes`
- `GET /conversion` — Funnel, tasas y tiempos.
- `GET /proyecciones` — Ventas, margen, clientes en riesgo.

### 2.3 Inventarios (`/api/inventarios`)
- `GET /stock-real-vs-teorico`
- `GET /clasificacion-abc`
- `GET /dias-sin-movimiento`
- `GET /demanda-historica`
- `GET /variacion-valor`
- `GET /no-conformes`
- `GET /bitacora-movimientos`
- `GET /solicitudes-material`
- `GET /entradas-mercancia`
- `GET /pedidos-incompletos`
- `GET /proyecciones`

### 2.4 Proveedores (`/api/proveedores`)
- `GET /compras-por-proveedor`
- `GET /tiempos-entrega`
- `GET /eficiencia`
- `GET /estados-pedidos`
- `GET /facturacion`
- `GET /tiempos-pago`
- `GET /scorecard/{proveedor_id}`
- `GET /proyecciones`

### 2.5 Gastos (`/api/gastos`)
- `GET /por-categoria`
- `GET /por-proveedor`
- `GET /deducibles-vs-no-deducibles`
- `GET /por-estado`
- `GET /por-metodo-pago`
- `GET /proyecciones`

### 2.6 Administración (`/api/administracion`)
- `GET /tiempos-por-etapa`
- `GET /retrasos-por-etapa`
- `GET /activacion-automatizaciones`
- `GET /proyecciones`

### 2.7 Reportes (`/api/reportes`)
- `POST /generar` — body: `{area, formato, secciones, filtros}`.
- `GET /{reporte_id}/download` — descarga.
- `POST /{reporte_id}/enviar-correo` — envía el reporte generado.
- `GET /historial` — reportes generados por usuario.

### 2.8 Automatización (`/api/automation`)
- `POST /trigger/{area}` — dispara flujo n8n.
- `POST /trigger-all` — dispara todos los flujos.
- `GET /status` — estado actual por flujo.
- `GET /logs` — últimas ejecuciones.

### 2.9 Sistema (`/api/system`)
- `GET /tunnel-status` — estado Cloudflare Tunnel.
- `GET /csv-status` — fecha de última actualización por CSV.
- `POST /copy-tunnel-link` — placeholder (normalmente se hace en frontend).

### 2.10 Auth (`/api/auth`)
- `POST /login` — emite JWT + refresh.
- `POST /refresh`
- `POST /logout`
- `GET /me`
- `POST /users` (solo admin).

### 2.11 Health (`/health`, `/metrics`)
- `GET /health` — liveness.
- `GET /ready` — readiness (DB + Redis + n8n alcanzable).
- `GET /metrics` — métricas Prometheus (opcional).

---

## 3. Estructura de Directorios (expandida)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app factory, include_routers
│   ├── config.py                 # Pydantic Settings (lee .env)
│   ├── dependencies.py           # get_db(), get_current_user()
│   ├── routes/
│   │   ├── dashboard.py
│   │   ├── ventas.py
│   │   ├── inventarios.py
│   │   ├── proveedores.py
│   │   ├── gastos.py
│   │   ├── administracion.py
│   │   ├── reportes.py
│   │   ├── automation.py
│   │   ├── system.py
│   │   ├── auth.py
│   │   └── health.py
│   ├── models/                   # SQLAlchemy models
│   ├── schemas/                  # Pydantic schemas (in/out)
│   ├── services/                 # Lógica de negocio
│   ├── utils/                    # CSV, email, DOCX, PDF, n8n
│   ├── middleware/
│   └── templates/
│       └── reportes/             # Plantillas Jinja para DOCX/PDF
│           ├── dashboard_general.docx.j2
│           ├── ventas.docx.j2
│           └── ...
├── tests/
├── alembic/
├── alembic.ini
├── pyproject.toml
├── requirements.txt
└── Dockerfile
```

---

## 4. Patrón de Capas

```
Routes (FastAPI) → Services (lógica) → Models/Repositories (DB/CSV)
           ↓
       Schemas (validación entrada/salida Pydantic)
```

- **Routes** solo orquestan: validan, delegan al service, devuelven schema.
- **Services** contienen la lógica de negocio, cálculos, agregaciones.
- **Models** manejan acceso a DB (SQLAlchemy).
- **Utils** son helpers sin estado (csv_utils, email_utils, etc.).
- **Schemas** validan entrada y formatean salida.

---

## 5. Configuración (`config.py`)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENV: str = "development"
    DATABASE_URL: str
    REDIS_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    N8N_BASE_URL: str
    N8N_WEBHOOK_TOKEN: str
    CSV_DIR: str = "/data/csv"
    REPORTS_DIR: str = "/data/reports"
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASS: str
    CLOUDFLARE_TUNNEL_NAME: str
    ALLOWED_ORIGINS: list[str] = []

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 6. Generación de Reportes

- **DOCX:** `python-docx` + plantillas `.docx.j2` con `docxtpl`.
- **PDF:** render HTML con Jinja y WeasyPrint a PDF. Alternativa: ReportLab.
- **Secciones seleccionables:** el body del `POST /generar` incluye `secciones: list[str]` que se mapean a bloques de la plantilla.
- **Almacenamiento:** `/data/reports/{YYYY}/{MM}/{reporte_id}.{docx|pdf}`.
- **Registro en DB:** tabla `reportes` con id, usuario, área, formato, fecha, ruta, correos enviados.

---

## 7. Envío de Correo

- SMTP con `aiosmtplib`.
- Plantilla Jinja para HTML del correo (`templates/email/reporte.html.j2`).
- Adjunta el archivo del reporte.
- Logs de envío en tabla `envios_reporte`.

---

## 8. Disparo de Flujos n8n

- Webhook seguros con header `X-N8N-TOKEN`.
- `utils/n8n_trigger.py`:

```python
import httpx
from app.config import settings

async def disparar_flujo(flujo: str, payload: dict | None = None) -> dict:
    url = f"{settings.N8N_BASE_URL}/webhook/{flujo}"
    headers = {"X-N8N-TOKEN": settings.N8N_WEBHOOK_TOKEN}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=payload or {}, headers=headers)
        r.raise_for_status()
        return r.json()
```

---

## 9. Tests

- `pytest-asyncio` para rutas async.
- `TestClient` de FastAPI para integración.
- Fixtures en `tests/conftest.py` para DB de prueba (SQLite in-memory o Postgres temporal).
- Cobertura mínima acordable — sugerencia 70%+ en services.

---

## 10. Dockerfile (resumen)

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libpango-1.0-0 libpangoft2-1.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
