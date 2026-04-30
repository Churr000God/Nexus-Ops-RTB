# Análisis del sistema RTB actual (Notion + n8n)

## Resumen del diagnóstico

El sistema actual **no es una base de datos** — es una colección de 19 "bases de datos" de Notion que el flujo de n8n aplana cada noche para hacerla parecer relacional. Los problemas que estás viendo no son de implementación: son estructurales, propios de usar Notion como ERP.

---

## Problemas estructurales detectados

### 1. Notion no es una BD relacional

Las "relaciones" en Notion son **rollups**, y el código del normalizador documenta literalmente: *"se toma siempre el primer elemento [0]; si hay múltiples, se pierden los adicionales"*. Esto significa que cualquier cotización con varios clientes vinculados, o cualquier OC con múltiples facturas, **pierde datos en silencio**. Un ERP no puede vivir con eso.

### 2. Tablas que deberían ser estados, no tablas

- **Cotizaciones Canceladas** es una tabla aparte. Debería ser `quotes.status = 'cancelled'` con `cancelled_at`, `cancellation_reason`. Tener una tabla aparte fuerza duplicación y rompe la unicidad del folio.
- **Pedidos Incompletos** apunta a la misma databaseId que Pedidos de Clientes. La documentación lo reconoce: *"los dos nodos apuntan al mismo databaseId. La diferencia está solo en el Set"*. Es una **vista filtrada disfrazada de tabla**.
- **Reporte de Ventas** es un espejo de cotizaciones aprobadas. Debería ser una **vista materializada** o una proyección, no una tabla que hay que mantener sincronizada.

### 3. Cálculos críticos viven en fórmulas de Notion

Subtotal, costo de compra, margen bruto, % empacado, días sin movimiento, semáforo ABC, cantidad teórica vs real... todo está como `_formula` en Notion, lo que significa:
- No puedes auditar el cálculo en SQL
- Si cambias una fórmula, el histórico **cambia retroactivamente** (no es inmutable)
- n8n solo lee el resultado; no puede recalcular ni validar

### 4. Inventario tiene tres "fuentes de verdad"

- `Gestión de Inventario` (rollups y fórmulas)
- `Bitácora de Movimientos` (log unificado)
- Las propias `Entradas de Mercancía` y `Detalles de Cotizaciones`

Si los tres divergen — y van a divergir — no hay forma de saber cuál es correcto. El diseño correcto es: **la bitácora es la única fuente de verdad**, y el stock actual se deriva por agregación (vista o columna calculada).

### 5. "Directorio de Ubicaciones" mezcla clientes y proveedores

Discriminado por `Tipo`. Los procesos son distintos (a clientes les vendes, a proveedores les compras), los datos fiscales que necesitas son distintos, las relaciones son distintas. Mantenerlos en una sola tabla obliga a poner columnas que solo aplican a uno de los dos como nullable. Y peor: la columna `raz_n_social` está mapeada a "Dirección" — el documento mismo marca esto como **bug** sin resolver.

### 6. Tipos inconsistentes

- `% empacado` se guarda como string en algunos lugares, number en otros
- `Estado Ariba` está tipado como number pero contiene strings
- Esto rompe agregaciones y reportes

### 7. No hay CFDI 4.0 propiamente

Tienes "FACTURAS COMPRAS" (las que recibes de proveedores) y campos sueltos de RFC, pero **no hay un módulo de emisión de CFDI**. Si el negocio factura a clientes mexicanos, esto es un faltante crítico: necesitas régimen fiscal, uso de CFDI, claves SAT de producto/unidad, UUID, sello, complementos de pago, etc.

### 8. Faltantes operativos

- **Sin gestión de usuarios y permisos** — solo "responsables" como rollups, sin roles ni control de acceso
- **Sin auditoría de cambios** — quién modificó qué y cuándo
- **Sin manejo histórico de precios** del proveedor (cambia el precio → se pierde el anterior)
- **Sin manejo histórico de costos** para valuación de inventario (PEPS, promedio ponderado)
- **Sin moneda explícita** (asume MXN siempre)
- **Filtro por `last_edited_time` del día**: cualquier corrección retroactiva se pierde del pipeline

### 9. Configurabilidad de productos no modelada

Vendes maquinaria industrial configurable, pero el `Catálogo de Productos` solo tiene SKU, descripción, precio, demanda. **No hay BOM, no hay opciones, no hay reglas de configuración**. Hoy probablemente lo manejas creando un SKU por configuración, lo que explota el catálogo.

---

## Lo que sí se rescata del diseño actual

- La **distinción cotización → pedido → reporte** es buena conceptualmente; solo hay que normalizarla.
- La **tabla puente Proveedores y Productos** con precio por proveedor es la idea correcta.
- El **verificador de fechas** como bitácora de hitos es un patrón válido (lo conservamos como `order_milestones`).
- La **bitácora unificada de inventario** es la dirección correcta — solo necesita ser **la única** fuente de verdad.
- Los **No Conformes** ligados a producto + factura + pedido capturan el contexto correcto.

---

## Conclusión

El rediseño no es cosmético — es estructural. Pasamos de:

| Hoy | Nuevo |
|---|---|
| 19 bases de Notion + flujo n8n | ~30 tablas PostgreSQL normalizadas |
| Rollups con `[0]` que pierden datos | Foreign keys con integridad referencial |
| Fórmulas no auditables | Vistas y columnas calculadas en SQL |
| 3 fuentes de verdad de inventario | 1 (bitácora) + vistas derivadas |
| Sin CFDI 4.0 | Módulo CFDI 4.0 SAT completo |
| Sin usuarios ni auditoría | RBAC + audit_log |
| Productos planos | Productos + atributos + BOM |

El siguiente documento (`02_modelo_nuevo.md`) describe el modelo objetivo.
