# ERR-0009: n8n enviaba "filesystem-v2" en lugar del contenido base64 del archivo

**Fecha:** 2026-04-21
**Area:** n8n
**Severidad:** medio
**Estado:** resuelto

## Descripcion
El nodo Code de n8n intentaba leer el contenido binario de un archivo CSV para enviarlo como base64, pero el campo `content` en el payload llegaba al backend con valor `"filesystem-v2"` (un token interno de n8n para archivos grandes en disco) en lugar del string base64 real.

## Contexto
El nodo Code construia el payload asi:
```javascript
// INCORRECTO
content: $input.item.binary.data.data  // devuelve "filesystem-v2"
```

## Causa Raiz
En versiones recientes de n8n, los datos binarios grandes se almacenan en el filesystem del worker bajo una referencia opaca (`filesystem-v2`). Acceder a `.binary.data.data` devuelve ese token, no el contenido real.

## Solucion
Usar el helper oficial de n8n para leer el buffer binario y convertirlo a base64:

```javascript
// CORRECTO
const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
const content = buffer.toString('base64');
```

Adicionalmente, el nodo HTTP Request debe configurarse con:
- **Body Content Type:** JSON
- Header: `x-sync-key: <valor del env>`

## Prevencion
Para cualquier nodo Code de n8n que procese datos binarios, siempre usar `helpers.getBinaryDataBuffer()` — nunca acceder directamente a `.binary.<prop>.data`.
