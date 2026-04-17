# Funcionalidades Globales de la Plataforma

**Propósito:** Especificar componentes, mecanismos y servicios que se reutilizan en todas las páginas — filtros, generación de reportes, envío por correo, automatización n8n, túnel Cloudflare, seguridad y notificaciones.

---

## 1. Filtros Avanzados (Componente Global)

Cada página hereda este componente; los valores se persisten en la URL (querystring) para permitir compartir vistas filtradas.

### Filtros Universales
- **Rango de fechas:** selector libre + presets (Hoy, 7d, 30d, MTD, QTD, YTD, Año pasado).
- **Categoría / Tipo de producto.**
- **Cliente o Proveedor** (autocomplete con búsqueda parcial).

### Filtros por Página
- **Ventas:** estado de cotización, tipo de cliente (Local/Foráneo), producto.
- **Inventarios:** clasificación ABC, tipo (Activo/Sin Movimiento/Obsoleto), estado.
- **Proveedores:** estado del pedido, estado de la factura, status y tipo de pago.
- **Gastos:** método de pago, estado, deducible.

### Comportamiento
- Aplicación inmediata sin recarga.
- Botón "Limpiar filtros".
- Indicador visible de cuántos filtros están activos.

---

## 2. Generación de Reportes (DOCX / PDF)

### Tipos de Reporte
| Origen | Formato | Contenido base |
|--------|---------|----------------|
| Dashboard General | DOCX/PDF | KPIs ejecutivos + 4 gráficos principales |
| Ventas | DOCX/PDF | Ventas totales, por cliente, margen, conversiones, proyecciones |
| Inventarios | DOCX/PDF | Stock vs. teórico, ABC, no conformes, movimientos |
| Proveedores | DOCX/PDF | Compras, tiempos, eficiencia, scorecard |
| Gastos | DOCX/PDF | Distribución por categoría/proveedor, deducibles |

### Reglas para Reportes
- **Fecha y periodo analizado** siempre presentes en la portada y pie de página.
- Tablas con los datos relevantes.
- Margen de ganancia, productos más vendidos, gastos acumulados, etc., según el área.
- **Logotipo y branding** RTB en encabezado.
- **Numeración de páginas** y tabla de contenido en reportes >5 páginas.
- **Selección modular:** el usuario elige qué secciones incluir antes de generar.

---

## 3. Envío por Correo

- Modal post-generación de reporte con:
  - Destinatarios (To, CC, BCC) — con autocomplete de contactos guardados.
  - Asunto editable (default: `Reporte [Área] · [Periodo] · Nexus Ops RTB`).
  - Cuerpo del correo editable con plantilla.
  - Adjunto automático del reporte generado.
- **Historial de envíos** consultable por usuario.
- **Confirmación por correo** al remitente.

---

## 4. Descarga de CSV

- Cada página tiene un botón "Descargar CSV".
- El CSV refleja **los filtros aplicados** en pantalla.
- Codificación UTF-8 con BOM (compatibilidad con Excel).
- Nombre de archivo: `{area}_{filtros_resumen}_{YYYYMMDD_HHMM}.csv`.
- En el dashboard general, opción adicional: descargar `.zip` con todos los CSV.

---

## 5. Automatización n8n

### Botones de Actualización
- **Dashboard general:** dispara todos los flujos en paralelo.
- **Cada página:** botón que dispara solo los flujos relevantes a esa área.

### Estado de Automatización
- Indicador por flujo: **completado** (verde) / **en proceso** (amarillo, con spinner) / **error** (rojo, con detalle clickable).
- **Última ejecución exitosa** mostrada como timestamp.
- **Re-ejecución manual** disponible incluso si el flujo programado falló.
- **Log de ejecuciones recientes** accesible en sección de administración.

### Flujos Identificados
- `update_reporte_ventas`
- `update_cotizaciones_clientes`
- `update_cotizaciones_canceladas`
- `update_pedidos_clientes`
- `update_crecimiento_inventario`
- `update_no_conformes`
- `update_gestion_inventario`
- `update_bitacora_movimientos`
- `update_solicitudes_material`
- `update_catalogo_productos`
- `update_proveedores_productos`
- `update_entradas_mercancia`
- `update_pedidos_incompletos`
- `update_solicitudes_proveedores`
- `update_facturas_compras`
- `update_gastos_operativos`
- `update_verificador_fechas_pedidos`

### Manejo de Errores
- **Errores de actualización** se registran y notifican al administrador.
- Notificación por correo y/o badge persistente en el dashboard.

---

## 6. Túnel Cloudflare y Seguridad

### Estado del Túnel
- Badge global visible en todas las páginas (header).
- Estados: **Activo** (verde), **Inactivo** (rojo), **Problema de conexión** (amarillo).
- Última verificación con timestamp.

### Sección de Administración (subpágina `/admin/tunel`)
- Estado detallado del túnel.
- Botón **"Copiar enlace de acceso"** del túnel Cloudflare.
- Histórico de uptime y reconexiones recientes.
- Reglas activas.

### Control de Acceso
- Acceso restringido a usuarios autorizados:
  - Dentro de la red WiFi local.
  - O conectados vía túnel de Cloudflare con token válido.
- Login con autenticación.

---

## 7. Notificaciones del Sistema

- Toast notifications para: actualización exitosa, error de actualización, generación de reporte completada, correo enviado.
- Centro de notificaciones persistente con últimas 50 notificaciones.
- Suscripción a alertas críticas por correo.

---

## 8. Componentes Reutilizables (UI Kit)

- `<KpiCard>` — tarjeta con valor, label, comparativo y delta.
- `<BarChart>`, `<LineChart>`, `<PieChart>`, `<StackedBarChart>`, `<ScatterChart>`, `<Gauge>`, `<FunnelChart>`.
- `<DataTable>` — tabla con paginación, ordenamiento y exportación.
- `<DateRangePicker>` con presets.
- `<MultiSelect>` con autocomplete.
- `<StatusBadge>` (verde / amarillo / rojo).
- `<ReportButton>` — desencadena modal de configuración de reporte.
- `<CsvDownloadButton>`.
- `<AutomationStatus>` — indicador de estado de un flujo n8n.
- `<TunnelStatus>` — indicador del túnel Cloudflare.

---

## 9. Optimización de Datos

- Las consultas se filtran por fecha y categoría desde el origen — sin cargas masivas innecesarias.
- Caché en memoria para resultados de consultas recientes.
- Paginación en tablas grandes (server-side).
- Carga progresiva de gráficos (skeleton loaders).

---

## 10. Bases de Datos Consumidas (Globales)
- Todas las bases listadas en `contexto/05_bases_de_datos.md` se consumen vía sus CSV refrescados por n8n.
- Las consultas siempre respetan los filtros activos.
