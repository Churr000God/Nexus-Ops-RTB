# Sistema RTB · Rediseño completo Notion → PostgreSQL

**Sistema ERP B2B** para venta de maquinaria industrial y partes, con migración del sistema actual basado en Notion + n8n a un esquema relacional bien diseñado en PostgreSQL 14+, con CFDI 4.0 nativo, gestión de equipos con piezas intercambiables, ruteo logístico y capa completa de reportes.

---

## Resumen ejecutivo

| Concepto | Cifra |
|---|---|
| Tablas | ~60 |
| Vistas analíticas | ~33 |
| Triggers | 12 |
| Funciones | 8 |
| Módulos funcionales | 8 |
| Documentos técnicos (Word) | 9 |
| Seeds SQL ejecutables | 7 |
| Dashboard HTML | 1 |
| Plan de migración | 1 |

**Estado:** Diseño completo, validado sintácticamente con sqlglot. Listo para implementar.

---

## Mapa del proyecto (qué hay y para qué sirve)

### 📋 Documentos de diseño

| Archivo | Contenido |
|---|---|
| `00_README.md` | Este documento — índice maestro |
| `01_analisis_sistema_actual.md` | Diagnóstico del sistema viejo (Notion + n8n) y problemas estructurales detectados |
| `02_modelo_nuevo.md` | Diseño conceptual del modelo objetivo, decisiones, mapeo Notion→PG |
| `06_logica_negocio.docx` | Documento técnico-funcional general — flujos extremo a extremo |
| `07_plan_migracion.md` | Estrategia de migración, mapeo tabla a tabla, ETL Python, cutover, rollback |

### 💾 Schema y código SQL

| Archivo | Contenido |
|---|---|
| `03_schema.sql` | DDL completo (~1300 líneas) — 60+ tablas con FKs, constraints, índices |
| `04_views_and_triggers.sql` | Vistas, triggers, funciones (~900 líneas) — incluye toda la analítica |
| `05_diagrama_er.svg` | Diagrama entidad-relación (versión inicial) |

### 📚 Documentación detallada por módulo

| # | Módulo | Documento | Tablas principales |
|---|---|---|---|
| 1 | **Seguridad y Auditoría** | `08_modulo_seguridad_auditoria.docx` | users, roles, permissions, role_permissions, user_roles, audit_log |
| 2 | **Productos y Pricing** | `09_modulo_productos_pricing.docx` | products, product_attributes, product_configurations, bom, customer_contract_prices |
| 3 | **Clientes y Proveedores** | `10_modulo_clientes_proveedores.docx` | customers, suppliers, *_tax_data, *_addresses, *_contacts, supplier_products |
| 4 | **Ventas y Logística** | `11_modulo_ventas_logistica.docx` | quotes, orders, delivery_notes, shipments, carriers, routes |
| 5 | **Compras** | `12_modulo_compras.docx` | purchase_requests, purchase_orders, supplier_invoices, goods_receipts |
| 6 | **Inventario y Assets** | `13_modulo_inventario_assets.docx` | inventory_movements, non_conformities, assets, asset_components |
| 7 | **CFDI 4.0** | `14_modulo_cfdi.docx` | cfdi, cfdi_items, cfdi_payments, cfdi_credit_notes, cfdi_issuer_config, cfdi_pac_log |
| 8 | **Reportes y Dashboards** | `15_modulo_reportes.docx` | (todas las vistas v_* analíticas) |

### 🌱 Seeds (datos de ejemplo ejecutables)

| Archivo | Contenido |
|---|---|
| `seed_seguridad.sql` | 5 roles, ~40 permisos, matriz role_permissions, usuario admin inicial |
| `seed_pricing.sql` | Categorías con margen, productos ejemplo, BOM, saldo inicial de inventario |
| `seed_clientes_proveedores.sql` | Cliente FEMSA con 3 RFCs y 6 direcciones, proveedor recurrente, proveedor ocasional |
| `seed_ventas_logistica.sql` | Flujo: 2 NRs → cotización consolidada → pedido → envío con tracking → ruta → 2 pagos parciales |
| `seed_compras.sql` | PR mixto (RESALE + INTERNAL + SERVICE) → PO → GR → factura SAT → pago + gasto operativo |
| `seed_inventario_assets.sql` | Tóner interno + PC con upgrade de RAM y reemplazo de SSD por falla |
| `seed_cfdi.sql` | Issuer config, series A/NC/CP, CFDI PPD con 2 pagos parciales generando complementos, NC tipo E |

### 🎨 Visualización

| Archivo | Contenido |
|---|---|
| `dashboard_ejecutivo.html` | Dashboard ejecutivo HTML interactivo con Chart.js (datos simulados, 8 KPIs + 5 gráficas) |

---

## Arquitectura del sistema

```
┌──────────────────────────────────────────────────────────────────────┐
│                    1. SEGURIDAD Y AUDITORÍA                          │
│   users · roles · permissions · audit_log                            │
└──────────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│ 2. CATÁLOGOS  │    │ 3. PRODUCTOS         │    │ 4. CLIENTES /   │
│   (SAT, brand,│    │  + atributos         │    │    PROVEEDORES  │
│    category)  │    │  + configurations    │    │                 │
│               │    │  + BOM + pricing     │    │  + tax_data     │
└───────────────┘    │  + cost history      │    │  + addresses    │
                     └──────────────────────┘    │  + contacts     │
                                                 │  + supplier_prod│
                                                 └─────────────────┘
                                                          │
                ┌─────────────────────────────────────────┤
                ▼                                         ▼
┌───────────────────────────┐              ┌────────────────────────┐
│   5. VENTAS               │              │   6. COMPRAS           │
│  delivery_notes           │              │  purchase_requests     │
│   ↓ (junction N:N)        │              │   ↓                    │
│  quotes ↔ quote_items     │              │  purchase_orders       │
│   ↓                       │              │   ↓                    │
│  orders ↔ order_items     │              │  goods_receipts        │
│   ↓                       │              │   ↓                    │
│  shipments + tracking     │              │  supplier_invoices     │
│  routes + stops           │              │  operating_expenses    │
└───────────┬───────────────┘              └────────────┬───────────┘
            │                                            │
            └─────────────┬──────────────────────────────┘
                          ▼
              ┌──────────────────────────┐
              │  7. INVENTARIO           │
              │  inventory_movements ◄── FUENTE DE VERDAD
              │  non_conformities         │
              │  assets + components      │
              │  asset_component_history  │
              │  (con history triggers)   │
              └──────────┬───────────────┘
                         │
                         ▼
              ┌──────────────────────────┐
              │  8. CFDI 4.0             │
              │  cfdi + items            │
              │  cfdi_credit_notes (NC)  │
              │  cfdi_payments (PPD)     │
              │  cfdi_pac_log            │
              │  payments                │
              └──────────────────────────┘
                         │
                         ▼
              ┌──────────────────────────┐
              │  9. REPORTES (vistas)    │
              │  Comercial, Margen,      │
              │  Compras, Financiero,    │
              │  Operación, Ejecutivo    │
              └──────────────────────────┘
```

---

## Despliegue (paso a paso)

### Pre-requisitos

- PostgreSQL 14+ (Supabase, RDS, Cloud SQL, o autohospedado)
- Extensions: `pgcrypto`, `citext`, `btree_gist` (las activa `03_schema.sql`)
- Catálogos SAT oficiales (descargar de http://omawww.sat.gob.mx)
- PAC contratado (Diverza, Edicom, Facturama, Solución Factible…)
- CSD (Certificado de Sello Digital) emitido por el SAT
- Bucket de almacenamiento para XML/PDF de CFDIs (S3, GCS)

### Pasos de instalación

```bash
# 1. Crear la BD
createdb rtb_production

# 2. Aplicar el schema completo
psql -d rtb_production -f 03_schema.sql

# 3. Aplicar vistas, triggers, funciones
psql -d rtb_production -f 04_views_and_triggers.sql

# 4. Cargar catálogos SAT (descargados aparte)
psql -d rtb_production -f catalogos_sat/c_ClaveProdServ.sql
psql -d rtb_production -f catalogos_sat/c_ClaveUnidad.sql
psql -d rtb_production -f catalogos_sat/c_RegimenFiscal.sql
psql -d rtb_production -f catalogos_sat/c_UsoCFDI.sql
psql -d rtb_production -f catalogos_sat/c_FormaPago.sql
psql -d rtb_production -f catalogos_sat/c_MetodoPago.sql

# 5. Aplicar seeds en orden (cada uno depende del anterior)
psql -d rtb_production -f seed_seguridad.sql
psql -d rtb_production -f seed_pricing.sql
psql -d rtb_production -f seed_clientes_proveedores.sql
psql -d rtb_production -f seed_compras.sql
psql -d rtb_production -f seed_inventario_assets.sql
psql -d rtb_production -f seed_ventas_logistica.sql
psql -d rtb_production -f seed_cfdi.sql

# 6. Verificar
psql -d rtb_production -c "SELECT COUNT(*) FROM rtb.users;"
psql -d rtb_production -c "SELECT COUNT(*) FROM rtb.products;"
psql -d rtb_production -c "SELECT * FROM rtb.v_executive_dashboard;"
```

---

## Migración desde Notion

Ver `07_plan_migracion.md` para el plan completo. Resumen:

```
┌───────────────────────┐
│  FASE 1 (sem 1-2):    │  Provisionar PG, deploy schema, cargar catálogos SAT,
│   PREPARACIÓN         │  construir scripts ETL Python contra API de Notion
└───────────────────────┘

┌───────────────────────┐
│  FASE 2 (sem 3):      │  Carga inicial: catálogos → entidades → histórico
│   CARGA INICIAL       │  Validaciones de integridad
└───────────────────────┘

┌───────────────────────┐
│  FASE 3 (sem 4-5):    │  Notion sigue siendo fuente; n8n replica deltas a PG
│   PARALELIZACIÓN      │  Equipo se entrena en sistema nuevo
└───────────────────────┘

┌───────────────────────┐
│  FASE 4 (sem 6):      │  Freeze Notion → última sincronización → switch DNS
│   CUTOVER             │  PG pasa a ser autoritativo, Notion read-only
└───────────────────────┘
```

**Cronograma estimado:** ~7 semanas con 1 ingeniero senior + 1 ingeniero de datos + 1 PM.

---

## Conexión con herramientas externas

### Aplicación propia (frontend / API)

Construir una capa REST/GraphQL sobre el schema. Recomendaciones:

- Usar `SET LOCAL rtb.current_user_id = '{user.id}';` al inicio de cada request para que `audit_log` registre quién hizo qué
- Validar permisos contra el JWT antes de cada operación
- Snapshotear datos fiscales al emitir CFDI (no FK viva)

### Herramientas de BI (Metabase / Superset / Tableau)

```sql
-- Crear usuario read-only
CREATE ROLE bi_readonly LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA rtb TO bi_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA rtb TO bi_readonly;
-- (Opcional, más restrictivo: solo a vistas v_*)
```

Apuntar la herramienta a la BD con ese usuario y crear dashboards visuales.

### Excel vía ODBC

Driver oficial PostgreSQL ODBC. Cada vista aparece como tabla. Útil para usuarios no técnicos.

### PAC (timbrado de CFDI)

Configurar `cfdi_issuer_config` con:

- RFC, razón social, régimen fiscal
- Ruta del CSD (.cer y .key)
- Contraseña del CSD encriptada en vault
- Endpoint del PAC y credenciales

La app maneja: generación de XML según SAT 4.0, sello con CSD, envío al PAC vía API REST, recepción de UUID y sello SAT, registro en `cfdi_pac_log`.

---

## Decisiones de diseño clave (lo que vale la pena recordar)

| Decisión | Por qué |
|---|---|
| **Una sola fuente de verdad de inventario** (`inventory_movements`) | Evita las 3 fuentes que tenía Notion |
| **Promedio móvil 6 meses con margen por categoría** | Modelo de pricing automático del usuario |
| **Cadena estricta de compras** (PR → PO → GR → Invoice → Pago) | Trigger valida que no se pague sin recepción |
| **Snapshots fiscales en CFDI y cotizaciones** | Datos no se mueven retroactivamente |
| **Multi-RFC por cliente** (`customer_tax_data` 1:N) | Para grupos como Femsa con varias razones sociales |
| **Notas de remisión como tabla separada con junction N:N a quotes** | Permite consolidar/dividir según necesidad operativa |
| **Productos con `is_saleable` flag** | Mismo sistema de inventario para productos vendibles e internos |
| **Assets con history table inmutable** | Trazabilidad completa de cambios de pieza en equipos |
| **CFDI cancelación con `replaces`/`replaced_by`** | Cumplimiento SAT con histórico claro |
| **RBAC con permisos granulares** + `SET LOCAL rtb.current_user_id` | Auditoría automática de cambios por usuario |
| **Vistas como API analítica** | Separa BI de operación; rendimiento via materialized views |
| **`is_credit GENERATED ALWAYS AS (sat_payment_method_id = 'PPD')`** | Derivar en lugar de duplicar |

---

## Próximos pasos sugeridos

### Inmediatos (semana 1)

1. **Validar el modelo con el equipo operativo** — sentar a ventas, compras, almacén, contabilidad y revisar caso por caso
2. **Decidir el PAC** — pedir cotizaciones a 2-3 proveedores
3. **Provisionar PostgreSQL de desarrollo** — Supabase para arrancar es lo más rápido

### Corto plazo (mes 1)

4. **Construir los ETLs Python** — siguiendo el esqueleto en `07_plan_migracion.md`
5. **Cargar catálogos SAT** oficiales en la BD de dev
6. **Probar el seed completo** y verificar que las vistas devuelven lo esperado
7. **Definir el stack de la aplicación** (¿Next.js? ¿NestJS? ¿Django? ¿FastAPI? ¿Rails?)

### Mediano plazo (mes 2-3)

8. **Implementar la app:** autenticación + RBAC + módulos de ventas y compras primero
9. **Integrar el PAC** y emitir primer CFDI de prueba en sandbox
10. **Conectar Metabase** y publicar primer dashboard interno
11. **Iniciar paralelización** (Notion sigue como fuente, app espejo)

### Largo plazo

12. **Cutover formal** según el plan de migración
13. **Notion en read-only** durante 3-6 meses
14. **Optimización:** materialized views si hay vistas lentas, particionado de `inventory_movements` si crece a millones

---

## Pendientes / Consideraciones futuras

Cosas que **no están en el alcance actual** y se podrían agregar después:

- **Garantías y servicio post-venta** (si el negocio crece a esto)
- **Trazabilidad por número de serie** en máquinas vendidas (cuando lo necesiten)
- **Multi-almacén** (si abren más bodegas)
- **Multi-empresa** (si crean otra razón social)
- **Carta porte** (si transportan mercancía con flota propia regularmente)
- **Integración con bancos** para conciliación automática
- **Portal web del cliente** para consulta de pedidos y pagos
- **Sincronización con marketplaces** (Mercado Libre, Amazon B2B)

Cuando alguno aparezca, se agrega como módulo nuevo sin tocar lo existente.

---

## Glosario rápido

| Término | Significado |
|---|---|
| **CFDI** | Comprobante Fiscal Digital por Internet (factura electrónica México) |
| **CSD** | Certificado de Sello Digital (lo emite el SAT) |
| **PAC** | Proveedor Autorizado de Certificación (timbra el CFDI) |
| **PUE** | Pago en Una Exhibición (contado) |
| **PPD** | Pago en Parcialidades o Diferido (crédito) — requiere complemento |
| **NC** | Nota de crédito (CFDI tipo E) |
| **NR** | Nota de remisión (cotización informal con entrega) |
| **OC / PO** | Orden de Compra |
| **PR** | Purchase Request (solicitud de material) |
| **GR** | Goods Receipt (entrada de mercancía) |
| **MOQ** | Minimum Order Quantity |
| **TDP** | Tamaño de Paquete (múltiplo de venta) |
| **TPP** | Tiempo Promedio de Pago |
| **AR / AP** | Accounts Receivable / Payable (cuentas por cobrar / pagar) |
| **ABC** | Clasificación de inventario por valor (A=alto, B=medio, C=bajo) |
| **BOM** | Bill of Materials (lista de materiales) |
| **RBAC** | Role-Based Access Control |
| **MTD** | Month-To-Date |
| **YTD** | Year-To-Date |

---

## Soporte y mantenimiento

**Si hay que modificar el modelo en el futuro:**

1. Crear migración SQL como `ALTER TABLE ...`
2. Actualizar el documento `.docx` correspondiente al módulo afectado
3. Si afecta vistas, actualizar `04_views_and_triggers.sql`
4. Documentar en `audit_log` quién hizo el cambio (vía contexto del DBA)
5. Si hay seed de ejemplo, actualizarlo

**Backups:**

- Completo diario, incremental por hora
- Retención: CFDI y `audit_log` ≥ 7 años (requisito SAT)
- XML/PDF de CFDI en blob storage con replicación geográfica

**Monitoreo:**

- Dashboard ejecutivo (`dashboard_ejecutivo.html`) como tablero diario
- Alertas si: stock crítico, NCs sin resolver, AR > 60 días, PPDs sin complemento, tasa de error de timbrado > 5%

---

## Cierre

El proyecto cubre el ciclo completo de un negocio B2B mexicano de maquinaria industrial: desde que entra una solicitud informal del cliente hasta que se cobra el pago final, pasando por cotización, orden, compra a proveedor, recepción, envío, factura electrónica con SAT, complementos de pago y cierre contable.

Lo que tienes en mano es **el diseño completo y validado** — schema, lógica de negocio, plan de migración. El siguiente paso es la **implementación**: construir la app sobre este modelo y migrar los datos.

Si en cualquier punto futuro tienes dudas, modificaciones, o un nuevo módulo, este conjunto de documentos es tu referencia. Cada `.docx` cubre su módulo en detalle (campos, triggers, vistas, ejemplos), cada `seed_*.sql` muestra cómo se llena, y este `00_README.md` es el mapa.

**Mucho éxito con la implementación.** 🚀
