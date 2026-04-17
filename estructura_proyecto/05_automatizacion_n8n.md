# Automatización — n8n

**Propósito:** Definir los flujos de n8n que actualizan CSV, sincronizan con la base de datos, disparan alertas y mantienen los dashboards alimentados con datos frescos.

---

## 1. Rol de n8n en la Arquitectura

- n8n es el **motor de orquestación** que extrae datos desde fuentes externas (ERP, Google Sheets, correos, APIs) y los deposita en dos destinos:
  1. **PostgreSQL** (fuente de verdad transaccional).
  2. **Archivos CSV** en `/data/csv/` (vista materializada para el dashboard).
- El backend dispara los flujos mediante webhooks autenticados.
- n8n también puede ejecutarse en **modo programado** (cron interno) para refrescos automáticos.

---

## 2. Instalación

- **Imagen oficial:** `n8nio/n8n:latest`.
- **Modo:** self-hosted en el mismo docker-compose del proyecto.
- **Persistencia:** volumen en `./automations/n8n_data/` (credenciales, historial, flujos).
- **Puerto interno:** 5678.
- **Acceso:** detrás del reverse proxy en `/n8n/` con autenticación básica + protección por IP de red interna.

---

## 3. Estructura de Directorios

```
automations/
├── n8n_data/                        # Volumen persistente (creds, db sqlite de n8n)
│   └── .gitkeep
├── n8n_flows/                       # Exports JSON de flujos (versionados)
│   ├── 01_actualizar_ventas.json
│   ├── 02_actualizar_cotizaciones.json
│   ├── 03_actualizar_clientes.json
│   ├── 04_actualizar_inventario.json
│   ├── 05_actualizar_movimientos_inventario.json
│   ├── 06_actualizar_no_conformes.json
│   ├── 07_actualizar_solicitudes_material.json
│   ├── 08_actualizar_entradas_mercancia.json
│   ├── 09_actualizar_pedidos_incompletos.json
│   ├── 10_actualizar_proveedores.json
│   ├── 11_actualizar_pedidos_proveedor.json
│   ├── 12_actualizar_facturas_compras.json
│   ├── 13_actualizar_gastos_operativos.json
│   ├── 14_actualizar_administracion.json
│   ├── 15_actualizar_todo.json        # meta-flujo que lanza todos
│   ├── 16_alertas_sistema.json
│   └── 17_backup_nocturno.json
├── scripts/
│   ├── export_flows.sh                # Exporta flujos a JSON
│   └── import_flows.sh                # Importa al iniciar un entorno nuevo
└── README.md
```

---

## 4. Convenciones de Flujos

- **Nombre del flujo:** `{número}_{acción}_{entidad}` (ej. `04_actualizar_inventario`).
- **Webhook path:** `/webhook/{entidad}` (ej. `/webhook/inventario`).
- **Método HTTP:** `POST`.
- **Header obligatorio:** `X-N8N-TOKEN: {token}` — rechaza si no coincide.
- **Respuesta:** JSON `{status, filas_procesadas, duracion_ms, errores: []}`.
- **Timeout:** 60 segundos (flujos largos corren en background y publican estado).

---

## 5. Patrón Estándar de un Flujo

```
Trigger (Webhook o Cron)
    ↓
Validar token (IF node)
    ↓
Extract (HTTP Request / Google Sheets / Read File)
    ↓
Transform (Function node con JS)
    ↓
┌───────────────┬───────────────┐
↓               ↓               ↓
Write CSV   Upsert DB     Log run
(/data/csv) (Postgres)   (automation_runs)
    ↓
Respond (HTTP Response)
```

Cada flujo:
1. Valida el token del header.
2. Extrae la fuente (ERP, sheet, API).
3. Transforma al formato canónico.
4. Escribe CSV **y** upsert en DB.
5. Registra en tabla `automation_runs` el resultado.
6. Devuelve `200` con resumen.

---

## 6. Meta-Flujo: `15_actualizar_todo`

- Trigger: webhook `/webhook/actualizar-todo` o cron diario 06:00.
- Invoca secuencialmente los flujos 01–14.
- Acumula resultados y devuelve un resumen consolidado.
- Si uno falla, continúa con el resto y marca el error en `automation_runs`.

---

## 7. Alertas del Sistema (`16_alertas_sistema`)

- Trigger: cron cada 15 minutos.
- Checks:
  - Productos con `stock_real < stock_minimo`.
  - Pedidos de proveedor con retraso (fecha_recepcion > esperada + umbral).
  - CSV sin refrescar en las últimas N horas.
  - Errores recientes en `automation_runs`.
- Si hay alertas, las inserta en la tabla `alertas` y (opcional) envía correo/Slack.

---

## 8. Backups (`17_backup_nocturno`)

- Trigger: cron diario 03:00.
- Pasos:
  1. Ejecuta `pg_dump` vía SSH Exec node.
  2. Comprime el resultado.
  3. Lo copia a volumen `backups/` y opcionalmente a S3/Drive.
  4. Registra en `automation_runs`.

---

## 9. Triggers desde el Backend

Endpoint: `POST /api/automation/trigger/{area}`

```python
# backend/app/services/automation_service.py
from app.utils.n8n_trigger import disparar_flujo
from app.models import AutomationRun
from sqlalchemy.orm import Session

AREAS = {
    "ventas": "actualizar-ventas",
    "inventario": "actualizar-inventario",
    "proveedores": "actualizar-proveedores",
    "gastos": "actualizar-gastos",
    "administracion": "actualizar-administracion",
    "todos": "actualizar-todo",
}

async def trigger_area(area: str, db: Session) -> dict:
    flujo = AREAS[area]
    run = AutomationRun(flujo=flujo, estado="running")
    db.add(run); db.commit()
    try:
        data = await disparar_flujo(flujo)
        run.estado = "ok"
        run.filas_procesadas = data.get("filas_procesadas", 0)
    except Exception as e:
        run.estado = "err"
        run.error_msg = str(e)
    finally:
        from datetime import datetime, timezone
        run.completado_en = datetime.now(timezone.utc)
        db.commit()
    return {"run_id": run.id, "estado": run.estado}
```

---

## 10. Observabilidad

- Tabla `automation_runs` en DB (ver `04_base_datos.md`).
- Endpoint `GET /api/automation/logs` expone las últimas ejecuciones con filtros por flujo y rango.
- Widget en `AdminSistema.tsx` con tabla + gráfica de tiempos.

---

## 11. Seguridad

- El webhook token (`N8N_WEBHOOK_TOKEN`) está en `.env` — backend y n8n lo comparten.
- n8n **no** expone su UI públicamente: sólo accesible via reverse proxy con basic auth y restricción a subred interna.
- Credenciales externas (ERP, SMTP) se almacenan en el vault interno de n8n, no en git.

---

## 12. Importación y Exportación de Flujos

### Exportar
```bash
./automations/scripts/export_flows.sh
# Corre dentro del contenedor n8n:
#   n8n export:workflow --all --output=/flows/
```

### Importar
```bash
./automations/scripts/import_flows.sh
# Corre dentro del contenedor n8n:
#   n8n import:workflow --separate --input=/flows/
```

Esto permite versionar los flujos como JSON en git y restaurar un entorno limpio rápidamente.

---

## 13. Consideraciones de Rendimiento

- Los flujos leen **sólo deltas** cuando es posible (usando `updated_at` o marcadores).
- Escritura de CSV en modo **append** cuando se trata de histórico inmutable.
- Upserts en DB con `ON CONFLICT DO UPDATE`.
- Para volúmenes grandes (> 100k filas), dividir en lotes de 1000 y usar `Split In Batches` node.
