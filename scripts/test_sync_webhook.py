"""
Script de prueba: simula a n8n enviando CSVs vacíos al backend
para activar el flujo upload-csv → finalize → import.

Uso:
    python scripts/test_sync_webhook.py [--base-url http://localhost:8000] [--key rtb-sync-2026]
"""
from __future__ import annotations

import argparse
import base64
import sys

import httpx

# Mapeo: nombre de dataset (según EXPECTED_DATASETS) → nombre de archivo CSV
DATASETS = [
    ("cotizaciones_a_clientes", "Cotizaciones_a_Clientes.csv"),
    ("detalle_cotizaciones", "Detalle_de_Cotizaciones.csv"),
    ("reporte_ventas", "Reporte_de_Ventas.csv"),
    ("cotizaciones_canceladas", "Cotizaciones_Canceladas.csv"),
    ("directorio_clientes_proveedores", "Directorio_Clientes_Proveedores.csv"),
    ("crecimiento_inventario", "Crecimiento_de_Inventario.csv"),
    ("gestion_inventario", "Gestion_de_Inventario.csv"),
    ("no_conformes", "No_Conformes.csv"),
    ("bitacora_movimientos", "Bitacora_de_Movimientos.csv"),
    ("solicitudes_material", "Solicitudes_de_Material.csv"),
    ("entradas_mercancia", "Entradas_de_Mercancia.csv"),
    ("pedidos_incompletos", "Pedidos_Incompletos.csv"),
    ("pedidos_clientes", "Pedidos_de_Clientes.csv"),
    ("proveedores_productos", "Proveedores_y_Productos.csv"),
    ("solicitudes_proveedores", "Solicitudes_A_Proveedores.csv"),
    ("gastos_operativos", "Gastos_Operativos_RTB.csv"),
    ("facturas_compras", "Facturas_Compras.csv"),
    ("verificador_fechas_pedidos", "Verificador_de_Fechas_Pedidos.csv"),
    ("catalogo_productos", "Catalogo_de_Productos.csv"),
]

EMPTY_CSV_B64 = base64.b64encode(b"").decode()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--key", default="rtb-sync-2026")
    args = parser.parse_args()

    headers = {"x-sync-key": args.key}
    errors: list[str] = []

    with httpx.Client(base_url=args.base_url, timeout=30) as client:
        print(f"Enviando {len(DATASETS)} datasets a {args.base_url}/api/sync/upload-csv ...\n")

        for dataset, filename in DATASETS:
            payload = {"dataset": dataset, "filename": filename, "content": EMPTY_CSV_B64}
            resp = client.post("/api/sync/upload-csv", json=payload, headers=headers)
            status = "OK" if resp.is_success else "ERROR"
            print(f"  [{status}] {dataset:45s} {resp.status_code}  {resp.text[:80]}")
            if not resp.is_success:
                errors.append(f"{dataset}: {resp.status_code} {resp.text}")

        print()
        if errors:
            print(f"Hubo {len(errors)} errores al subir CSVs:")
            for e in errors:
                print(f"  - {e}")
            print("\nLlamando a /finalize de todas formas...")

        print("Llamando a /api/sync/finalize ...")
        resp = client.post("/api/sync/finalize", headers=headers)
        print(f"  finalize -> {resp.status_code}  {resp.text}")

        print()
        resp = client.get("/api/sync/status", headers=headers)
        print(f"Estado actual: {resp.text}")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
