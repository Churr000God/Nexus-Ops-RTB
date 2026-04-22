# ERR-0008: ModuleNotFoundError al importar `app` en subprocess de sync

**Fecha:** 2026-04-21
**Area:** backend
**Severidad:** alto
**Estado:** resuelto

## Descripcion
Al ejecutar `sync_csv_data.py` como subprocess desde `sync_service.py` dentro del contenedor Docker, el script fallaba con:
```
ModuleNotFoundError: No module named 'app'
```

## Contexto
`sync_service.py` lanza `sync_csv_data.py` usando `asyncio.create_subprocess_exec`. El script importa modulos del proyecto (`from app.models...`). El proceso padre (FastAPI/uvicorn) corre con `PYTHONPATH=/app`, pero ese valor no se propaga automaticamente al entorno del subprocess.

## Causa Raiz
`os.environ` del proceso padre contiene `PYTHONPATH=/app` en tiempo de ejecucion de uvicorn, pero `create_subprocess_exec` sin `env=` argumento hereda el entorno del proceso padre en el momento de la llamada — que puede no incluir `PYTHONPATH` si fue seteado solo en el `CMD` del Dockerfile y no exportado globalmente.

## Solucion
Construir explicitamente el entorno del subprocess preservando el env actual y forzando `PYTHONPATH`:

```python
import os

app_root = script.parent.parent  # /app dentro del contenedor
env = os.environ.copy()
existing = env.get("PYTHONPATH", "")
env["PYTHONPATH"] = f"{app_root}{os.pathsep}{existing}" if existing else str(app_root)

proc = await asyncio.create_subprocess_exec(
    sys.executable, str(script), *args,
    env=env,
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.PIPE,
)
```

## Prevencion
Siempre pasar `env=env` con PYTHONPATH explicitamente cuando se llamen subprocesos Python que importen modulos del proyecto. No asumir que el subprocess hereda el entorno correctamente.
