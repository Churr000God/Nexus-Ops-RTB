// Genera 08_modulo_seguridad_auditoria.docx
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Header, Footer, PageBreak
} = require('docx');

const ARIAL = "Arial";
const COLOR_DARK = "1F2937";
const COLOR_GRAY = "6B7280";
const COLOR_BLUE = "2563EB";
const COLOR_HEADER = "1F2937";
const COLOR_CODE_BG = "F3F4F6";

const heading = (text, level) => new Paragraph({
  heading: level,
  children: [new TextRun({ text, font: ARIAL })]
});
const h1 = (t) => heading(t, HeadingLevel.HEADING_1);
const h2 = (t) => heading(t, HeadingLevel.HEADING_2);
const h3 = (t) => heading(t, HeadingLevel.HEADING_3);
const p = (t, opts={}) => new Paragraph({
  children: [new TextRun({ text: t, font: ARIAL, ...opts })],
  spacing: { after: 120 }
});
const pBold = (t) => p(t, { bold: true });
const pItalic = (t) => p(t, { italics: true });

// Bloque de código (mono, fondo gris)
const code = (text) => {
  const lines = text.split('\n');
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: COLOR_CODE_BG },
    spacing: { before: 120, after: 120 },
    children: lines.flatMap((line, i) => {
      const runs = [new TextRun({ text: line || ' ', font: "Courier New", size: 18 })];
      if (i < lines.length - 1) runs.push(new TextRun({ break: 1 }));
      return runs;
    })
  });
};

const inlineCode = (t) => new TextRun({ text: t, font: "Courier New", size: 20 });

const bullet = (t) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [new TextRun({ text: t, font: ARIAL })]
});
const bulletMixed = (children) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children
});
const numList = (t) => new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  children: [new TextRun({ text: t, font: ARIAL })]
});

const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function makeTable(rows, columnWidths, headerColor=COLOR_HEADER) {
  const totalWidth = columnWidths.reduce((a,b)=>a+b,0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: rows.map((row, idx) => new TableRow({
      tableHeader: idx === 0,
      children: row.map((cell, cIdx) => {
        // cell puede ser string o {text, bold, mono}
        const cellObj = typeof cell === 'string' ? { text: cell } : cell;
        return new TableCell({
          borders,
          width: { size: columnWidths[cIdx], type: WidthType.DXA },
          shading: idx === 0 ? { fill: headerColor, type: ShadingType.CLEAR } : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: cellObj.text,
              font: cellObj.mono ? "Courier New" : ARIAL,
              size: cellObj.mono ? 18 : 20,
              bold: idx === 0 || cellObj.bold,
              color: idx === 0 ? "FFFFFF" : COLOR_DARK
            })]
          })]
        });
      })
    }))
  });
}

const children = [];

// ================================================================
// PORTADA
// ================================================================
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 2400, after: 240 },
  children: [new TextRun({ text: "Módulo de Seguridad", font: ARIAL, size: 56, bold: true })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 240 },
  children: [new TextRun({ text: "y Auditoría", font: ARIAL, size: 56, bold: true })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 360, after: 120 },
  children: [new TextRun({ text: "Sistema RTB · PostgreSQL", font: ARIAL, size: 28, color: COLOR_GRAY })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
  children: [new TextRun({ text: "users · roles · permissions · role_permissions · user_roles · audit_log", font: "Courier New", size: 20, color: COLOR_BLUE })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 1200 },
  children: [new TextRun({ text: "Documento de diseño y operación · v1.0", font: ARIAL, size: 22, color: COLOR_GRAY })]
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 1. INTRODUCCIÓN
// ================================================================
children.push(h1("1. Introducción"));
children.push(p("Este documento describe en detalle el módulo de Seguridad y Auditoría del sistema RTB. Cubre el propósito de cada tabla, sus campos, las relaciones entre ellas, las reglas de llenado, y las consultas comunes que el sistema debe soportar."));
children.push(p("El módulo está construido sobre dos patrones probados de la industria:"));
children.push(bulletMixed([
  new TextRun({ text: "RBAC (Role-Based Access Control)", font: ARIAL, bold: true }),
  new TextRun({ text: " — los usuarios no reciben permisos directamente. Pertenecen a roles, y los roles tienen los permisos. Esto facilita escalar: cuando entra un comprador nuevo, le asignas el rol PURCHASING en lugar de configurar 30 permisos uno por uno.", font: ARIAL })
]));
children.push(bulletMixed([
  new TextRun({ text: "Audit Trail inmutable", font: ARIAL, bold: true }),
  new TextRun({ text: " — cada cambio relevante en cotizaciones, órdenes, CFDI, inventario, etc., queda registrado en una bitácora con quién, cuándo, qué cambió. La bitácora no se edita ni se borra.", font: ARIAL })
]));

children.push(h2("1.1 Objetivos del módulo"));
children.push(bullet("Controlar quién puede entrar al sistema (autenticación)."));
children.push(bullet("Controlar qué puede hacer cada usuario una vez dentro (autorización)."));
children.push(bullet("Mantener un registro inmutable de todos los cambios significativos para cumplimiento, depuración y rendición de cuentas."));
children.push(bullet("Permitir reconstruir el histórico de cualquier registro afectado: \"¿quién aprobó esta cotización? ¿qué tenía antes?\""));
children.push(bullet("Soportar separación de responsabilidades: el que crea no necesariamente aprueba; el que recibe mercancía no necesariamente paga."));

children.push(h2("1.2 Tablas que componen el módulo"));
children.push(makeTable([
  ["Tabla", "Tipo", "Propósito breve"],
  ["users", "Maestra", "Operadores humanos del sistema (no clientes ni proveedores)."],
  ["roles", "Catálogo", "Tipos de usuario (ADMIN, SALES, PURCHASING, WAREHOUSE, ACCOUNTING)."],
  ["permissions", "Catálogo", "Acciones atómicas que se pueden permitir o negar (quote.create, etc.)."],
  ["role_permissions", "Puente N:N", "Qué permisos tiene cada rol."],
  ["user_roles", "Puente N:N", "Qué roles tiene cada usuario."],
  ["audit_log", "Bitácora", "Registro inmutable de cambios en cualquier tabla auditada."]
], [2200, 1500, 5660]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 2. RELACIONES ENTRE TABLAS
// ================================================================
children.push(h1("2. Relaciones entre tablas"));
children.push(p("La pieza central del modelo es la matriz N:N usuarios ↔ roles ↔ permisos, resuelta con dos tablas puente. La auditoría es un módulo aparte que captura cambios en cualquier tabla, no solo de seguridad."));

children.push(h2("2.1 Diagrama lógico"));
children.push(p("Cada flecha indica una foreign key. La cardinalidad se lee \"una fila aquí puede aparecer en N filas allá\"."));
children.push(code(
`    users                                    roles
  ┌────────────┐                          ┌────────────┐
  │ user_id PK │                          │ role_id PK │
  │ email      │                          │ code       │
  │ ...        │                          │ name       │
  └─────┬──────┘                          └─────┬──────┘
        │ 1                                     │ 1
        │                                       │
        │ N                                     │ N
        ▼                                       ▼
  ┌─────────────────────────┐    ┌──────────────────────────┐
  │      user_roles         │    │     role_permissions     │
  │  user_id  FK ──────────►│────│  role_id  FK             │
  │  role_id  FK ───────────┼─┐  │  permission_id  FK ────┐ │
  │  granted_at             │ │  └────────────────────────┼─┘
  │  PK (user_id, role_id)  │ │                           │
  └─────────────────────────┘ │                           │
                              │                           ▼
                              │                    ┌────────────────┐
                              │                    │ permissions    │
                              │                    │ permission_id  │
                              └────────────────────│ code           │
                                                   │ description    │
                                                   └────────────────┘

    audit_log  ── referencia polimórfica ── (cualquier tabla)
  ┌─────────────────┐
  │ audit_id PK     │      FK opcional
  │ user_id ────────┼─────► users
  │ entity_type     │
  │ entity_id       │      ← apunta lógicamente a la fila afectada
  │ action          │      ← INSERT / UPDATE / DELETE
  │ before_data     │      ← JSONB con el snapshot
  │ after_data      │
  │ changed_at      │
  └─────────────────┘`));

children.push(h2("2.2 Tipo de relaciones"));
children.push(makeTable([
  ["Origen → destino", "Cardinalidad", "Significado"],
  ["users → user_roles", "1 : N", "Un usuario tiene 0, 1 o más asignaciones de rol."],
  ["roles → user_roles", "1 : N", "Un rol está asignado a 0, 1 o más usuarios."],
  ["users ↔ roles", "N : N (vía user_roles)", "Un usuario tiene varios roles; un rol cubre varios usuarios."],
  ["roles → role_permissions", "1 : N", "Un rol tiene 0, 1 o más permisos asignados."],
  ["permissions → role_permissions", "1 : N", "Un permiso pertenece a 0, 1 o más roles."],
  ["roles ↔ permissions", "N : N (vía role_permissions)", "Un rol agrupa varios permisos; un permiso lo comparten varios roles."],
  ["users → audit_log", "1 : N", "Un usuario genera muchos cambios; cada cambio es una fila en audit_log."]
], [3000, 2200, 4160]));

children.push(h2("2.3 Acciones referenciales"));
children.push(p("Las foreign keys definen qué pasa cuando se borra o actualiza el registro padre."));
children.push(makeTable([
  ["FK", "Acción", "Razón"],
  ["user_roles.user_id", "ON DELETE CASCADE", "Si se elimina el usuario, sus asignaciones de rol desaparecen."],
  ["user_roles.role_id", "ON DELETE CASCADE", "Si se elimina el rol, las asignaciones se limpian."],
  ["role_permissions.role_id", "ON DELETE CASCADE", "Si se elimina el rol, sus permisos asignados se limpian."],
  ["role_permissions.permission_id", "ON DELETE CASCADE", "Si se elimina un permiso, deja de estar en cualquier rol."],
  ["audit_log.user_id", "Sin acción (FK simple, NULL permitido)", "Si por algún motivo se borrara el usuario, el log queda con user_id = NULL pero conserva los datos."]
], [2700, 2700, 3960]));
children.push(pItalic("Nota operativa: en RTB no se borra usuarios físicamente. Se desactivan con is_active=false. Los CASCADE existen como salvaguarda en ambientes de prueba o limpieza administrativa controlada."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 3. TABLA users
// ================================================================
children.push(h1("3. Tabla users"));
children.push(pBold("Propósito: registro de operadores humanos del sistema."));
children.push(p("Aquí van los empleados o colaboradores que entran al sistema (Diego de ventas, María de almacén, el contador externo). NO incluye clientes ni proveedores — esos están en customers y suppliers respectivamente."));

children.push(h2("3.1 Definición"));
children.push(code(
`CREATE TABLE users (
    user_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           CITEXT NOT NULL UNIQUE,
    full_name       TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);`));

children.push(h2("3.2 Campos"));
children.push(makeTable([
  ["Campo", "Tipo", "Obligatorio", "Características y reglas"],
  ["user_id", "BIGINT", "Sí (auto)", "Identidad autogenerada. Inmutable. Es la PK que referencian las demás tablas."],
  ["email", "CITEXT", "Sí", "Login del usuario. Case-insensitive: 'Diego@RTB.com' = 'diego@rtb.com'. UNIQUE: no se permite duplicado."],
  ["full_name", "TEXT", "Sí", "Nombre completo para mostrar en interfaz y reportes."],
  ["password_hash", "TEXT", "Sí", "Hash del password (bcrypt o argon2id, mínimo 60 caracteres). Nunca el password en claro."],
  ["is_active", "BOOLEAN", "Sí (default TRUE)", "FALSE = el usuario no puede iniciar sesión; sus registros históricos se preservan."],
  ["last_login_at", "TIMESTAMPTZ", "No", "Fecha del último login exitoso. Se actualiza desde la app al autenticar."],
  ["created_at", "TIMESTAMPTZ", "Sí (default now())", "Fecha de alta."],
  ["updated_at", "TIMESTAMPTZ", "Sí (default now())", "Fecha de última modificación. La app o un trigger lo actualiza."]
], [1800, 1500, 1500, 4560]));

children.push(h2("3.3 Cómo se llena"));
children.push(numList("Lo da de alta un usuario con permiso user.manage (típicamente ADMIN)."));
children.push(numList("La aplicación toma el password en claro, lo pasa por bcrypt/argon2id, y solo guarda el hash."));
children.push(numList("El campo email se valida con expresión regular en la capa de aplicación antes de insertar."));
children.push(numList("is_active se inicializa en TRUE. Para baja, se actualiza a FALSE (NUNCA DELETE)."));

children.push(h2("3.4 Ejemplo de inserción"));
children.push(code(
`-- En la app:
-- const hash = await bcrypt.hash('SuperSecreta123!', 12);
INSERT INTO rtb.users (email, full_name, password_hash)
VALUES (
  'maria.lopez@rtb.com',
  'María López Hernández',
  '$2b$12$abcdefghijklmnopqrstuvwxyz0123456789...'
)
RETURNING user_id;`));

children.push(h2("3.5 Reglas operativas"));
children.push(bullet("NUNCA borrar usuarios. Para baja: UPDATE users SET is_active = FALSE WHERE user_id = X."));
children.push(bullet("Cambio de password: la app valida el password actual, hashea el nuevo, y hace UPDATE users SET password_hash = ... WHERE user_id = X."));
children.push(bullet("Reset de password: la app genera un token de un solo uso (en otra tabla password_reset_tokens, fuera de este módulo) y, al validarlo, actualiza el hash."));
children.push(bullet("Cambio de email: requiere validación por token enviado al email nuevo."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 4. TABLA roles
// ================================================================
children.push(h1("4. Tabla roles"));
children.push(pBold("Propósito: catálogo de los tipos de usuario que existen en el sistema."));
children.push(p("Es una tabla pequeña (5–10 filas en la vida del sistema). Define perfiles operativos. Cada rol agrupa los permisos típicos de una función."));

children.push(h2("4.1 Definición"));
children.push(code(
`CREATE TABLE roles (
    role_id       SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    description   TEXT
);`));

children.push(h2("4.2 Campos"));
children.push(makeTable([
  ["Campo", "Tipo", "Obligatorio", "Características y reglas"],
  ["role_id", "SMALLINT", "Sí (auto)", "PK. SMALLINT porque máximo se esperan ~50 roles en la vida del sistema."],
  ["code", "TEXT", "Sí, UNIQUE", "Identificador estable usado por el código de la app. MAYÚSCULAS, sin espacios, sin acentos. Ej: 'ADMIN', 'SALES'."],
  ["name", "TEXT", "Sí", "Nombre humano para interfaz. Ej: 'Administrador', 'Ventas'."],
  ["description", "TEXT", "No", "Texto libre que describe responsabilidades del rol."]
], [1800, 1400, 1500, 4660]));

children.push(h2("4.3 Roles estándar de RTB"));
children.push(makeTable([
  ["code", "name", "Responsabilidades"],
  ["ADMIN", "Administrador", "Configuración del sistema, alta de usuarios y roles, acceso total."],
  ["SALES", "Ventas", "Crea cotizaciones, gestiona clientes, da seguimiento a pedidos. No edita inventario."],
  ["PURCHASING", "Compras", "Crea solicitudes de material, OCs a proveedores, captura facturas de compra."],
  ["WAREHOUSE", "Almacén", "Registra entradas de mercancía, valida físicamente, gestiona no conformes y ajustes."],
  ["ACCOUNTING", "Contabilidad", "Emite CFDI, registra pagos, gestiona gastos operativos, conciliación bancaria."]
], [1800, 1700, 5860]));

children.push(h2("4.4 Cómo se llena"));
children.push(p("Por seed inicial (script de instalación). Solo el ADMIN crea roles nuevos posteriormente, y rara vez."));
children.push(code(
`INSERT INTO rtb.roles (code, name, description) VALUES
('ADMIN',      'Administrador', 'Acceso total al sistema'),
('SALES',      'Ventas',        'Cotizaciones, clientes, seguimiento de pedidos'),
('PURCHASING', 'Compras',       'Solicitudes, OCs, facturas de proveedor'),
('WAREHOUSE',  'Almacén',       'Recepciones, ajustes, no conformes, empacado'),
('ACCOUNTING', 'Contabilidad',  'CFDI, pagos, gastos operativos');`));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 5. TABLA permissions
// ================================================================
children.push(h1("5. Tabla permissions"));
children.push(pBold("Propósito: catálogo atómico de acciones que se pueden permitir o negar."));
children.push(p("Cada acción concreta que un usuario puede hacer (crear cotización, aprobar cotización, ajustar inventario, emitir CFDI...) tiene su fila aquí. Es la pieza más granular del sistema de seguridad."));

children.push(h2("5.1 Definición"));
children.push(code(
`CREATE TABLE permissions (
    permission_id  SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           TEXT NOT NULL UNIQUE,
    description    TEXT
);`));

children.push(h2("5.2 Campos"));
children.push(makeTable([
  ["Campo", "Tipo", "Obligatorio", "Características y reglas"],
  ["permission_id", "SMALLINT", "Sí (auto)", "PK. Hasta ~32k permisos cabe."],
  ["code", "TEXT", "Sí, UNIQUE", "Convención: <entidad>.<acción> en minúsculas. Ej: 'quote.create', 'inventory.adjust'."],
  ["description", "TEXT", "Recomendado", "Explicación humana del permiso para uso en interfaz de administración."]
], [1800, 1400, 1500, 4660]));

children.push(h2("5.3 Catálogo recomendado para RTB"));
children.push(p("Esta es una propuesta de los permisos atómicos que cubren la operación. Pueden ajustarse según vaya creciendo el sistema."));

children.push(makeTable([
  ["code", "Descripción"],
  ["user.view",          "Ver lista de usuarios."],
  ["user.manage",        "Crear, editar, desactivar usuarios."],
  ["role.manage",        "Crear roles y asignar permisos."],
  ["customer.view",      "Ver clientes y sus datos."],
  ["customer.manage",    "Crear, editar, desactivar clientes."],
  ["supplier.view",      "Ver proveedores."],
  ["supplier.manage",    "Crear, editar, desactivar proveedores."],
  ["product.view",       "Ver catálogo de productos."],
  ["product.manage",     "Crear, editar productos y configuraciones."],
  ["product.price.manage", "Cambiar precios de venta."],
  ["quote.view",         "Ver cotizaciones."],
  ["quote.create",       "Crear cotizaciones nuevas."],
  ["quote.edit",         "Editar cotización en estado DRAFT."],
  ["quote.send",         "Enviar cotización al cliente (status SENT)."],
  ["quote.approve",      "Aprobar cotización (status APPROVED, dispara orden)."],
  ["quote.cancel",       "Cancelar cotización."],
  ["order.view",         "Ver pedidos."],
  ["order.pack",         "Empacar pedido (actualizar quantity_packed)."],
  ["order.ship",         "Marcar pedido como enviado."],
  ["order.deliver",      "Confirmar entrega."],
  ["order.cancel",       "Cancelar pedido."],
  ["purchase_request.create", "Crear solicitud de material."],
  ["purchase_request.approve", "Aprobar solicitud de material."],
  ["purchase_order.create", "Crear OC al proveedor."],
  ["purchase_order.send", "Enviar OC."],
  ["purchase_order.cancel", "Cancelar OC."],
  ["goods_receipt.create", "Registrar entrada de mercancía."],
  ["goods_receipt.validate", "Validar físicamente la mercancía recibida."],
  ["supplier_invoice.capture", "Capturar factura de proveedor."],
  ["supplier_invoice.pay",     "Marcar factura de proveedor como pagada."],
  ["non_conformity.create",   "Levantar no conforme."],
  ["non_conformity.resolve",  "Resolver no conforme."],
  ["inventory.view",          "Consultar stock."],
  ["inventory.adjust",        "Ajuste manual de inventario."],
  ["cfdi.issue",              "Emitir CFDI tipo I al cliente."],
  ["cfdi.cancel",              "Cancelar CFDI ante el SAT."],
  ["cfdi.credit_note",         "Emitir nota de crédito (CFDI tipo E)."],
  ["payment.register",         "Registrar pago recibido del cliente."],
  ["expense.create",           "Capturar gasto operativo."],
  ["report.sales",             "Ver reporte de ventas."],
  ["report.inventory",         "Ver reporte de inventario y KPIs."],
  ["report.financial",         "Ver reportes financieros."],
  ["audit.view",               "Ver bitácora de auditoría."]
], [3500, 5860]));

children.push(h2("5.4 Cómo se llena"));
children.push(p("Por seed inicial. Conforme se agreguen funcionalidades nuevas a la aplicación, se agregan permisos correspondientes vía migración."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 6. TABLA role_permissions
// ================================================================
children.push(h1("6. Tabla role_permissions"));
children.push(pBold("Propósito: asignar permisos a roles."));
children.push(p("Tabla puente N:N entre roles y permissions. Es donde se define qué puede hacer cada rol."));

children.push(h2("6.1 Definición"));
children.push(code(
`CREATE TABLE role_permissions (
    role_id        SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id  SMALLINT NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);`));

children.push(h2("6.2 Campos"));
children.push(makeTable([
  ["Campo", "Tipo", "Características y reglas"],
  ["role_id", "SMALLINT NOT NULL", "FK → roles. ON DELETE CASCADE."],
  ["permission_id", "SMALLINT NOT NULL", "FK → permissions. ON DELETE CASCADE."]
], [1800, 2400, 5160]));
children.push(p("La PK compuesta (role_id, permission_id) automáticamente impide asignar dos veces el mismo permiso al mismo rol."));

children.push(h2("6.3 Matriz sugerida (rol × permiso)"));
children.push(p("V = el rol tiene este permiso."));
children.push(makeTable([
  ["Permiso", "ADMIN", "SALES", "PURCH.", "WHSE", "ACCT"],
  ["user.view / .manage",   "V", "",  "",  "",  ""],
  ["role.manage",           "V", "",  "",  "",  ""],
  ["customer.view",         "V", "V", "",  "",  "V"],
  ["customer.manage",       "V", "V", "",  "",  ""],
  ["supplier.view",         "V", "",  "V", "V", "V"],
  ["supplier.manage",       "V", "",  "V", "",  ""],
  ["product.view",          "V", "V", "V", "V", "V"],
  ["product.manage",        "V", "",  "",  "",  ""],
  ["product.price.manage",  "V", "V", "",  "",  ""],
  ["quote.view",            "V", "V", "",  "",  "V"],
  ["quote.create / edit",   "V", "V", "",  "",  ""],
  ["quote.send",            "V", "V", "",  "",  ""],
  ["quote.approve",         "V", "V (jefe)", "", "", ""],
  ["quote.cancel",          "V", "V", "",  "",  ""],
  ["order.view",            "V", "V", "V", "V", "V"],
  ["order.pack / ship",     "V", "",  "",  "V", ""],
  ["order.cancel",          "V", "V", "",  "",  ""],
  ["purchase_request.*",    "V", "",  "V", "V", ""],
  ["purchase_order.*",      "V", "",  "V", "",  ""],
  ["goods_receipt.*",       "V", "",  "",  "V", ""],
  ["supplier_invoice.*",    "V", "",  "V", "",  "V"],
  ["non_conformity.*",      "V", "",  "",  "V", ""],
  ["inventory.view",        "V", "V", "V", "V", "V"],
  ["inventory.adjust",      "V", "",  "",  "V", ""],
  ["cfdi.issue / cancel / credit_note", "V", "", "", "", "V"],
  ["payment.register",      "V", "",  "",  "",  "V"],
  ["expense.create",        "V", "",  "",  "",  "V"],
  ["report.sales",          "V", "V", "",  "",  "V"],
  ["report.inventory",      "V", "V", "V", "V", "V"],
  ["report.financial",      "V", "",  "",  "",  "V"],
  ["audit.view",            "V", "",  "",  "",  ""]
], [3000, 1300, 1300, 1300, 1300, 1160]));

children.push(h2("6.4 Cómo se llena (seeds)"));
children.push(p("Después del seed de roles y permisos, se asignan así:"));
children.push(code(
`-- ADMIN tiene TODOS los permisos
INSERT INTO rtb.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM rtb.roles r CROSS JOIN rtb.permissions p
WHERE r.code = 'ADMIN';

-- SALES con permisos específicos
INSERT INTO rtb.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM rtb.roles r, rtb.permissions p
WHERE r.code = 'SALES'
  AND p.code IN (
    'customer.view','customer.manage','product.view','product.price.manage',
    'quote.view','quote.create','quote.edit','quote.send','quote.approve','quote.cancel',
    'order.view','order.cancel','inventory.view','report.sales','report.inventory'
  );`));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 7. TABLA user_roles
// ================================================================
children.push(h1("7. Tabla user_roles"));
children.push(pBold("Propósito: asignar roles a usuarios."));
children.push(p("Tabla puente N:N entre users y roles. Aquí se define qué tipo de usuario es cada persona. Un usuario puede tener varios roles (Diego es ADMIN+SALES, María es WAREHOUSE+PURCHASING)."));

children.push(h2("7.1 Definición"));
children.push(code(
`CREATE TABLE user_roles (
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id     SMALLINT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);`));

children.push(h2("7.2 Campos"));
children.push(makeTable([
  ["Campo", "Tipo", "Características y reglas"],
  ["user_id", "BIGINT NOT NULL", "FK → users. ON DELETE CASCADE."],
  ["role_id", "SMALLINT NOT NULL", "FK → roles. ON DELETE CASCADE."],
  ["granted_at", "TIMESTAMPTZ NOT NULL DEFAULT now()", "Cuándo se concedió el rol. Útil para auditoría."]
], [1800, 2700, 4860]));

children.push(h2("7.3 Cómo se llena"));
children.push(p("Solo un usuario con permiso user.manage o role.manage puede asignar roles. La operación típica es desde una pantalla \"Gestión de usuarios\":"));
children.push(code(
`-- Asignar el rol SALES al usuario user_id=2
INSERT INTO rtb.user_roles (user_id, role_id)
VALUES (2, (SELECT role_id FROM rtb.roles WHERE code = 'SALES'))
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Quitar un rol
DELETE FROM rtb.user_roles
WHERE user_id = 2 AND role_id = (SELECT role_id FROM rtb.roles WHERE code = 'SALES');`));

children.push(h2("7.4 Reglas operativas"));
children.push(bullet("No se permiten duplicados gracias a la PK compuesta."));
children.push(bullet("Cada cambio en user_roles debe quedar registrado en audit_log para saber quién dio o quitó qué rol."));
children.push(bullet("El usuario superadmin (user_id=1) NUNCA debe perder el rol ADMIN — la app debe protegerlo."));
children.push(bullet("Cuando un usuario se desactiva (is_active=false), sus user_roles NO se borran, solo el is_active impide el login."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 8. TABLA audit_log
// ================================================================
children.push(h1("8. Tabla audit_log"));
children.push(pBold("Propósito: bitácora inmutable de cambios en cualquier tabla auditada."));
children.push(p("Es la tabla más distinta del módulo. No tiene que ver con \"qué se puede hacer\" sino con \"qué se hizo\". Captura quién, cuándo, en qué entidad, qué tipo de operación, y los datos antes y después."));

children.push(h2("8.1 Definición"));
children.push(code(
`CREATE TABLE audit_log (
    audit_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT REFERENCES users(user_id),
    entity_type  TEXT NOT NULL,
    entity_id    BIGINT NOT NULL,
    action       TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    before_data  JSONB,
    after_data   JSONB,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity     ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_changed_at ON audit_log (changed_at DESC);`));

children.push(h2("8.2 Campos"));
children.push(makeTable([
  ["Campo", "Tipo", "Características y reglas"],
  ["audit_id", "BIGINT", "PK autogenerada. Cada cambio es una fila nueva."],
  ["user_id", "BIGINT (FK, nullable)", "Quién hizo el cambio. Puede ser NULL para cambios automáticos del sistema."],
  ["entity_type", "TEXT NOT NULL", "Nombre de la tabla afectada en minúsculas: 'quote', 'order', 'cfdi', etc."],
  ["entity_id", "BIGINT NOT NULL", "PK del registro afectado en esa tabla. Referencia polimórfica (no hay FK física)."],
  ["action", "TEXT NOT NULL", "INSERT, UPDATE o DELETE (validado por CHECK)."],
  ["before_data", "JSONB", "Snapshot de la fila antes del cambio. NULL si action=INSERT."],
  ["after_data", "JSONB", "Snapshot de la fila después del cambio. NULL si action=DELETE."],
  ["changed_at", "TIMESTAMPTZ NOT NULL", "Momento exacto del cambio."]
], [1500, 2000, 5860]));

children.push(h2("8.3 Cómo se llena (automáticamente vía trigger)"));
children.push(p("La función fn_audit_changes es genérica y se conecta a cada tabla que se quiere auditar. Lee el user_id de una variable de sesión que la app debe setear:"));
children.push(code(
`-- 1. La app, al iniciar transacción, identifica al usuario
SET LOCAL rtb.current_user_id = '3';   -- Juan está autenticado

-- 2. Cualquier operación dispara el trigger
UPDATE rtb.quotes SET status = 'SENT' WHERE quote_id = 42;

-- 3. El trigger inserta automáticamente en audit_log
--    user_id=3, entity_type='quotes', entity_id=42,
--    action='UPDATE', before_data={status:'DRAFT',...},
--    after_data={status:'SENT',...}`));

children.push(p("La línea SET LOCAL es crítica: solo aplica a la transacción actual, no afecta otras sesiones."));

children.push(h2("8.4 Tablas que se auditan"));
children.push(p("No todas las tablas necesitan auditoría. Se activan triggers solo en las críticas:"));
children.push(makeTable([
  ["Tabla", "¿Auditar?", "Razón"],
  ["users", "Sí", "Cambios en passwords, activación, email."],
  ["user_roles", "Sí", "Cambios de privilegios deben rastrearse."],
  ["role_permissions", "Sí", "Cambios en políticas de seguridad."],
  ["quotes", "Sí", "Cambios de estado, totales, cliente."],
  ["orders", "Sí", "Estado, fechas de hitos."],
  ["cfdi", "Sí", "Cancelaciones requieren rastro."],
  ["inventory_movements", "Sí (INSERT)", "Solo se auditan inserciones; no se actualizan ni borran."],
  ["purchase_orders", "Sí", "Cambios en cantidades y precios."],
  ["supplier_invoices", "Sí", "Captura y modificación de facturas."],
  ["product_prices", "Sí", "Cambios de precio histórico."],
  ["customer_tax_data", "Sí", "Cambios fiscales del cliente."],
  ["audit_log", "NO", "Es la bitácora misma. Auditarla causaría loop infinito."]
], [3000, 1500, 4860]));

children.push(h2("8.5 Consultas típicas sobre audit_log"));

children.push(h3("Quién aprobó la cotización 42 y cuándo"));
children.push(code(
`SELECT a.changed_at, u.full_name,
       a.before_data->>'status' AS de,
       a.after_data->>'status'  AS a_que
FROM rtb.audit_log a
LEFT JOIN rtb.users u ON u.user_id = a.user_id
WHERE a.entity_type = 'quotes'
  AND a.entity_id   = 42
  AND a.action      = 'UPDATE'
  AND a.before_data->>'status' = 'SENT'
  AND a.after_data->>'status'  = 'APPROVED'
ORDER BY a.changed_at;`));

children.push(h3("Todo el historial de la cotización 42"));
children.push(code(
`SELECT a.changed_at, u.full_name, a.action, a.before_data, a.after_data
FROM rtb.audit_log a
LEFT JOIN rtb.users u ON u.user_id = a.user_id
WHERE a.entity_type = 'quotes' AND a.entity_id = 42
ORDER BY a.changed_at;`));

children.push(h3("Qué hizo el usuario X en el último mes"));
children.push(code(
`SELECT a.changed_at, a.entity_type, a.entity_id, a.action
FROM rtb.audit_log a
WHERE a.user_id   = 3
  AND a.changed_at >= now() - INTERVAL '30 days'
ORDER BY a.changed_at DESC;`));

children.push(h3("Quién bajó stock del SKU X anoche"));
children.push(code(
`SELECT a.changed_at, u.full_name,
       a.after_data->>'quantity_out' AS cantidad,
       a.after_data->>'movement_type' AS tipo
FROM rtb.audit_log a
LEFT JOIN rtb.users u ON u.user_id = a.user_id
WHERE a.entity_type = 'inventory_movements'
  AND a.action      = 'INSERT'
  AND (a.after_data->>'product_id')::BIGINT = 1500
  AND a.changed_at::DATE = CURRENT_DATE - 1
  AND (a.after_data->>'quantity_out')::NUMERIC > 0;`));

children.push(h2("8.6 Reglas operativas"));
children.push(bullet("Inmutabilidad: nunca UPDATE ni DELETE sobre audit_log. Es append-only."));
children.push(bullet("Retención: mínimo 7 años (recomendado por requisitos fiscales y de cumplimiento mexicanos)."));
children.push(bullet("Volumen: si crece a millones de filas, particionar por mes (PARTITION BY RANGE (changed_at))."));
children.push(bullet("La consulta por fecha y por entidad debe ser eficiente — los índices definidos cubren ambos casos."));
children.push(bullet("Si la app no setea rtb.current_user_id, user_id queda NULL. Esto debe alertar (es señal de bug en la app o de operación administrativa)."));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 9. FLUJO COMPLETO DE AUTENTICACIÓN Y AUTORIZACIÓN
// ================================================================
children.push(h1("9. Flujo completo: login y autorización"));

children.push(h2("9.1 Login (autenticación)"));
children.push(numList("Usuario envía email + password."));
children.push(numList("App busca: SELECT user_id, password_hash, is_active FROM users WHERE email = ?"));
children.push(numList("Valida is_active = TRUE. Si FALSE → 'Usuario desactivado'."));
children.push(numList("Verifica password con bcrypt.compare(password, password_hash)."));
children.push(numList("Si OK: actualiza last_login_at, carga permisos del usuario, genera JWT firmado."));

children.push(h2("9.2 Carga de permisos (al inicio de sesión)"));
children.push(code(
`SELECT DISTINCT p.code
FROM rtb.users u
JOIN rtb.user_roles ur       ON ur.user_id = u.user_id
JOIN rtb.role_permissions rp ON rp.role_id = ur.role_id
JOIN rtb.permissions p       ON p.permission_id = rp.permission_id
WHERE u.user_id = $1 AND u.is_active = TRUE;
-- Resultado: ['quote.create', 'quote.send', 'inventory.view', ...]`));
children.push(p("Esta lista se incluye en el JWT (o se cachea en Redis) para no consultar la BD en cada request."));

children.push(h2("9.3 Autorización (en cada request)"));
children.push(numList("Cliente envía request con JWT en header Authorization."));
children.push(numList("Backend valida firma del JWT y extrae user_id + permisos."));
children.push(numList("Antes de ejecutar la acción, verifica: ¿el JWT contiene el permiso requerido? Si no → 403 Forbidden."));
children.push(numList("Si sí, abre transacción y setea SET LOCAL rtb.current_user_id = $userId."));
children.push(numList("Ejecuta operación. El trigger fn_audit_changes registra automáticamente quién hizo qué."));
children.push(numList("Commit."));

children.push(h2("9.4 Ejemplo concreto: Diego aprueba la cotización 42"));
children.push(code(
`-- (a) Cliente: POST /api/quotes/42/approve
-- (b) Backend valida JWT, extrae user_id=1, verifica permiso 'quote.approve'
-- (c) Backend ejecuta:
BEGIN;
SET LOCAL rtb.current_user_id = '1';
UPDATE rtb.quotes
   SET status         = 'APPROVED',
       approval_date  = CURRENT_DATE
 WHERE quote_id = 42 AND status = 'SENT';
COMMIT;

-- (d) Triggers que se dispararon, en orden:
--    1. fn_recalc_quote_totals       (no aplica, solo cambió status)
--    2. fn_log_quote_status_change   → INSERT en quote_status_history
--    3. fn_create_order_from_approved_quote → INSERT en orders + order_items
--    4. fn_audit_changes              → INSERT en audit_log con before/after`));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ================================================================
// 10. SEED INICIAL Y CHECKLIST
// ================================================================
children.push(h1("10. Seed inicial y checklist de instalación"));

children.push(p("Al instalar el sistema por primera vez, ejecutar en este orden:"));
children.push(numList("Aplicar 03_schema.sql (tablas)."));
children.push(numList("Aplicar 04_views_and_triggers.sql (vistas y triggers, incluyendo fn_audit_changes)."));
children.push(numList("Cargar seeds del módulo de seguridad: roles, permissions, role_permissions."));
children.push(numList("Crear el usuario administrador inicial."));
children.push(numList("Asignarle el rol ADMIN."));
children.push(numList("Verificar con consultas de validación que todos los roles tienen sus permisos esperados."));

children.push(h2("10.1 Validaciones post-seed"));
children.push(code(
`-- ¿Cuántos permisos tiene cada rol?
SELECT r.code, COUNT(rp.permission_id) AS num_permisos
FROM rtb.roles r
LEFT JOIN rtb.role_permissions rp ON rp.role_id = r.role_id
GROUP BY r.code
ORDER BY r.code;
-- ADMIN debería tener TODOS los permisos.

-- ¿Cuántos roles tiene cada usuario?
SELECT u.email, COUNT(ur.role_id) AS num_roles
FROM rtb.users u
LEFT JOIN rtb.user_roles ur ON ur.user_id = u.user_id
GROUP BY u.email;

-- ¿Algún permiso huérfano (sin rol que lo tenga)?
SELECT p.code FROM rtb.permissions p
LEFT JOIN rtb.role_permissions rp ON rp.permission_id = p.permission_id
WHERE rp.permission_id IS NULL;`));

children.push(h2("10.2 Reglas de oro"));
children.push(bullet("Nunca borrar usuarios ni filas de audit_log físicamente."));
children.push(bullet("Nunca asignar permisos directo a usuarios. Siempre vía rol."));
children.push(bullet("Mantener al menos UN usuario con rol ADMIN activo. La app debe impedir desactivar al último."));
children.push(bullet("Hashear passwords con bcrypt cost ≥ 12 o argon2id."));
children.push(bullet("La app SIEMPRE debe setear rtb.current_user_id antes de cualquier escritura."));
children.push(bullet("Revisar audit_log periódicamente: actividad sospechosa, accesos fuera de horario, cambios de privilegios."));

// ================================================================
// 11. APÉNDICE: SEED COMPLETO
// ================================================================
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(h1("11. Apéndice: archivo seed_seguridad.sql"));
children.push(p("El archivo SQL listo para ejecutar se entrega aparte como seed_seguridad.sql. Contiene:"));
children.push(bullet("INSERT de los 5 roles estándar."));
children.push(bullet("INSERT de los ~40 permisos atómicos del catálogo."));
children.push(bullet("INSERT de la matriz role_permissions completa."));
children.push(bullet("INSERT del usuario admin@rtb.com inicial (con password hash placeholder — reemplazar por hash real bcrypt)."));
children.push(bullet("Asignación del rol ADMIN al usuario inicial."));
children.push(bullet("Consultas de verificación post-instalación."));

const doc = new Document({
  creator: "Sistema RTB",
  title: "Módulo de Seguridad y Auditoría",
  description: "Documentación detallada del módulo de seguridad y auditoría",
  styles: {
    default: { document: { run: { font: ARIAL, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: ARIAL, color: COLOR_DARK },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: ARIAL, color: COLOR_DARK },
        paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: ARIAL, color: "374151" },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "RTB · Seguridad y Auditoría", font: ARIAL, size: 18, color: COLOR_GRAY })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Página ", font: ARIAL, size: 18, color: COLOR_GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: ARIAL, size: 18, color: COLOR_GRAY })
          ]
        })]
      })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/sessions/bold-dazzling-brahmagupta/mnt/outputs/rtb/08_modulo_seguridad_auditoria.docx", buf);
  console.log("DOCX listo:", buf.length, "bytes");
});
