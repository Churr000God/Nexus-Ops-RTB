# Frontend — React + Vite + TypeScript

**Propósito:** Especificación de la SPA que implementa los dashboards, filtros, reportes y estado del sistema.

---

## 1. Stack y Dependencias Principales

| Paquete | Propósito |
|---------|-----------|
| `react`, `react-dom` | UI base |
| `vite` | Build y dev server |
| `typescript` | Tipado estático |
| `react-router-dom` | Ruteo SPA |
| `@tanstack/react-query` | Cache de data server-side |
| `zustand` | State global (filtros, auth) |
| `axios` | Cliente HTTP |
| `recharts` | Gráficas principales |
| `chart.js` + `react-chartjs-2` | Complemento para casos avanzados |
| `tailwindcss`, `postcss`, `autoprefixer` | Estilos |
| `shadcn/ui` + `lucide-react` | Componentes + iconos |
| `date-fns` | Manejo de fechas |
| `papaparse` | Procesamiento CSV en cliente |
| `zod` | Validación de schemas |
| `react-hook-form` | Formularios |
| `vitest`, `@testing-library/react` | Tests unitarios |
| `eslint`, `prettier` | Linter y formato |

---

## 2. Rutas Principales

| Ruta | Página | Auth |
|------|--------|------|
| `/login` | Login | No |
| `/` | Dashboard General | Sí |
| `/ventas` | Dashboard de Ventas | Sí |
| `/inventarios` | Dashboard de Inventarios | Sí |
| `/proveedores` | Dashboard de Proveedores | Sí |
| `/gastos` | Dashboard de Gastos | Sí |
| `/administracion` | Dashboard de Administración | Sí |
| `/reportes` | Listado e historial de reportes | Sí |
| `/admin/sistema` | Estado de túnel, n8n, logs | Sí + admin |

Rutas protegidas con HOC `<RequireAuth>` que valida el token y redirige a `/login` si no hay sesión.

---

## 3. Estructura de Directorios (expandida)

```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Ventas.tsx
│   │   ├── Inventarios.tsx
│   │   ├── Proveedores.tsx
│   │   ├── Gastos.tsx
│   │   ├── Administracion.tsx
│   │   ├── Reportes.tsx
│   │   ├── Login.tsx
│   │   ├── AdminSistema.tsx
│   │   └── NotFound.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── TunnelStatus.tsx
│   │   │   ├── AutomationStatus.tsx
│   │   │   └── RequireAuth.tsx
│   │   ├── dashboards/
│   │   │   ├── DashboardGeneral.tsx
│   │   │   ├── VentasDashboard.tsx
│   │   │   ├── InventariosDashboard.tsx
│   │   │   ├── ProveedoresDashboard.tsx
│   │   │   ├── GastosDashboard.tsx
│   │   │   └── AdministracionDashboard.tsx
│   │   ├── charts/
│   │   │   ├── BarChart.tsx
│   │   │   ├── LineChart.tsx
│   │   │   ├── PieChart.tsx
│   │   │   ├── StackedBarChart.tsx
│   │   │   ├── ScatterChart.tsx
│   │   │   ├── Gauge.tsx
│   │   │   └── FunnelChart.tsx
│   │   ├── common/
│   │   │   ├── KpiCard.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── MultiSelect.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── ReportButton.tsx
│   │   │   ├── CsvDownloadButton.tsx
│   │   │   ├── EmailReportModal.tsx
│   │   │   └── LoadingSkeleton.tsx
│   │   └── reportes/
│   │       └── ReportesGenerados.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   ├── useFilters.ts
│   │   ├── useAutomation.ts
│   │   └── useTunnelStatus.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   ├── ventasService.ts
│   │   ├── inventariosService.ts
│   │   ├── proveedoresService.ts
│   │   ├── gastosService.ts
│   │   ├── administracionService.ts
│   │   ├── reportesService.ts
│   │   └── systemService.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   └── filtersStore.ts
│   ├── utils/
│   │   ├── csvUtils.ts
│   │   ├── emailUtils.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   ├── types/
│   │   ├── ventas.ts
│   │   ├── inventarios.ts
│   │   ├── proveedores.ts
│   │   ├── gastos.ts
│   │   ├── reportes.ts
│   │   └── common.ts
│   └── styles/
│       └── globals.css
├── tests/
│   ├── setup.ts
│   └── components/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .eslintrc.cjs
├── .prettierrc
└── Dockerfile
```

---

## 4. Cliente HTTP (`services/api.ts`)

- Instancia Axios configurada con `baseURL = import.meta.env.VITE_API_URL`.
- Interceptor de request que añade `Authorization: Bearer <token>`.
- Interceptor de response que refresca el token si recibe 401.
- Helper para construir query params desde el estado de filtros.

---

## 5. State Management

### 5.1 `authStore` (Zustand)
- `user`, `accessToken`, `refreshToken`.
- Acciones: `login`, `logout`, `refresh`.

### 5.2 `filtersStore`
- Estado compartido entre páginas para filtros globales (fecha, categoría).
- Sincronización con querystring (`useSearchParams`) para URLs compartibles.

### 5.3 React Query
- Cada servicio expone hooks `useVentasPorCliente`, `useKpisDashboard`, etc.
- `staleTime` configurable para evitar refetch excesivo.
- Invalidación de queries al disparar actualizaciones manuales.

---

## 6. Componentes Reutilizables

### 6.1 `<KpiCard>`
Props: `label`, `value`, `format` (`currency`/`percent`/`number`), `delta`, `trend`.

### 6.2 `<DataTable>`
- Paginación server-side.
- Ordenamiento.
- Filtros por columna.
- Export a CSV.

### 6.3 Gráficas
- Envoltorios sobre Recharts con API uniforme.
- Soporte para loading state, empty state y error state.

### 6.4 `<ReportButton>`
- Abre modal con:
  - Formato (DOCX/PDF).
  - Secciones seleccionables.
  - Rango de fechas.
  - Destinatarios (si se va a enviar por correo).

### 6.5 `<AutomationStatus>` y `<TunnelStatus>`
- Se actualizan cada N segundos vía polling o WebSocket.

---

## 7. Internacionalización

- Todo el texto en español por ahora.
- Preparado para i18n con `react-i18next` si se internacionaliza en el futuro.

---

## 8. Responsive Design

- Breakpoints de Tailwind:
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
- Objetivo inicial: desktop (≥1280px) y tablet (≥768px).
- Mobile: vista simplificada en fase 2.

---

## 9. Accesibilidad

- Contraste AA mínimo.
- Todas las gráficas con `aria-label`.
- Navegación por teclado funcional.
- Focus visible en todos los interactivos.

---

## 10. Build y Dockerfile

### `Dockerfile` (multistage)

```dockerfile
# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve con Nginx
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 11. Variables de Entorno del Frontend

Se cargan en tiempo de build (prefijo `VITE_`):

- `VITE_API_URL`
- `VITE_APP_NAME`
- `VITE_ENV`
- `VITE_POLL_INTERVAL_MS`

---

## 12. Tests

- Unitarios con Vitest + React Testing Library.
- E2E (opcional): Playwright para flujos críticos (login, generación de reporte).
