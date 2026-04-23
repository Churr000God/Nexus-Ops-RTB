# ERR-0013: AttributeError CT_TcPr sin metodo get_or_add_shd en python-docx 1.1.2

**Fecha:** 2026-04-23
**Area:** backend
**Severidad:** alto
**Estado:** resuelto

## Descripcion

```
AttributeError: 'CT_TcPr' object has no attribute 'get_or_add_shd'.
Did you mean: 'get_or_add_tcW'?
```

El error ocurria al intentar aplicar color de fondo (shading) a celdas de encabezado de tabla en el DOCX generado con python-docx 1.1.2.

## Contexto

Se estaba generando un reporte DOCX en `backend/app/services/report_service.py`. La funcion `_style_header_cell` intentaba obtener o crear el elemento `<w:shd>` usando:

```python
tcPr = tc.get_or_add_tcPr()
shd = tcPr.get_or_add_shd()   # <-- este metodo no existe
```

## Causa Raiz

`CT_TcPr` (la clase Python que representa `<w:tcPr>` en el XML de Word) en python-docx 1.1.2 no expone un metodo `get_or_add_shd()`. Solo algunos elementos OxmlElement tienen helpers `get_or_add_*` predefinidos; `shd` no es uno de ellos en esta version.

## Solucion

Usar `lxml.etree.SubElement` directamente para crear el nodo `<w:shd>` con los atributos requeridos por el esquema OOXML:

```python
from lxml import etree
from docx.oxml.ns import qn

def _style_header_cell(cell) -> None:
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    # Eliminar shd previo si existe para evitar duplicados
    for existing in tcPr.findall(qn("w:shd")):
        tcPr.remove(existing)
    shd = etree.SubElement(tcPr, qn("w:shd"))
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), "1E40AF")   # azul RTB en hex
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if p.runs:
        p.runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        p.runs[0].bold = True
```

## Efecto Secundario Encontrado

La excepcion no capturada escapaba el `CORSMiddleware` de Starlette, causando que el navegador reportara "No 'Access-Control-Allow-Origin' header" en lugar del error 500 real. Se resolvio envolviendo la generacion en try/except → HTTPException dentro del router (patron estandar del proyecto).

## Prevencion

- En python-docx, siempre usar `lxml.etree.SubElement` para agregar elementos XML sin helper predefinido.
- Verificar la API de `CT_*` en el codigo fuente de python-docx antes de asumir que existe `get_or_add_*`.
- Envolver toda la logica de generacion de archivos en try/except en los routers.

## Archivos Afectados

- `backend/app/services/report_service.py` — funcion `_style_header_cell`
- `backend/app/routers/reportes.py` — try/except en `generar_reporte_ventas`
