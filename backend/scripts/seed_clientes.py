#!/usr/bin/env python3
"""Importa clientes desde el CSV del directorio de clientes/proveedores.

Uso (dentro del contenedor backend):
    python scripts/seed_clientes.py
    python scripts/seed_clientes.py --dry-run
"""
from __future__ import annotations

import csv
import os
import re
import sys
from argparse import ArgumentParser

from sqlalchemy import create_engine, text

CSV_PATH = "/data/csv/Directorio_Clientes_Proveedores.csv"

COL_NOMBRE = 0
COL_SIGLAS = 1
COL_TIPO = 2
COL_CATEGORIA = 3
COL_ESTATUS = 4
COL_RFC = 5
COL_CONTACTO = 6
COL_TELEFONO = 7
COL_EMAIL = 8
COL_DIRECCION = 9
COL_TPP = 12


def clean(val: str) -> str:
    return re.sub(r"\s+", " ", val.strip()) if val else ""


def clean_rfc(val: str) -> str:
    return re.sub(r"\s+", "", val.upper()) if val else ""


def is_vacio(val: str) -> bool:
    return val.strip().upper() in ("", "VACIO", "VACÍO", "N/A", "NA")


def is_valid_rfc(rfc: str) -> bool:
    return 12 <= len(rfc) <= 13 and rfc.upper() not in ("PENDIENTE", "VACIO")


def make_code_from_siglas(siglas: str) -> str | None:
    code = re.sub(r"\s+", "", siglas.strip().upper())
    code = re.sub(r"[^\w\-]", "", code)[:40]
    return code if len(code) >= 2 else None


def generate_code_from_name(nombre: str, used_codes: set[str]) -> str | None:
    words = re.findall(r"\w+", nombre.upper())
    base = "".join(w[:4] for w in words[:4])[:16]
    if not base:
        base = re.sub(r"[^\w]", "", nombre.upper())[:8]
    if not base:
        return None
    code = base
    i = 2
    while code in used_codes:
        suffix = str(i)
        code = f"{base[:40 - len(suffix) - 1]}-{suffix}"
        i += 1
        if i > 999:
            return None
    return code


def parse_payment_terms(val: str) -> int:
    try:
        n = float(val)
        days = round(n)
        return max(0, min(days, 365))
    except (ValueError, TypeError):
        return 0


def main() -> None:
    parser = ArgumentParser(description="Seed clientes desde CSV.")
    parser.add_argument("--dry-run", action="store_true", help="No escribe en la BD")
    args = parser.parse_args()

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[ERR] Falta variable de entorno DATABASE_URL", file=sys.stderr)
        sys.exit(1)

    engine = create_engine(db_url)

    with engine.connect() as conn:
        existing_codes: set[str] = {
            row[0] for row in conn.execute(text("SELECT code FROM customers"))
        }

    print(f"Códigos existentes en BD: {len(existing_codes)}")
    print(f"Modo: {'DRY-RUN (no escribe)' if args.dry_run else 'REAL'}")
    print("-" * 60)

    used_codes: set[str] = set(existing_codes)
    inserted = skipped = errors = 0

    with engine.connect() as conn:
        with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            next(reader)  # saltar cabecera

            for row_num, row in enumerate(reader, start=2):
                while len(row) < 13:
                    row.append("")

                nombre = clean(row[COL_NOMBRE])
                siglas = clean(row[COL_SIGLAS])
                tipo = clean(row[COL_TIPO])
                categoria = clean(row[COL_CATEGORIA])
                estatus = clean(row[COL_ESTATUS])
                rfc_raw = clean_rfc(row[COL_RFC])
                contacto = clean(row[COL_CONTACTO])
                telefono = clean(row[COL_TELEFONO])
                email_raw = clean(row[COL_EMAIL])
                direccion = clean(row[COL_DIRECCION])
                tpp_str = clean(row[COL_TPP])

                if tipo.upper() != "CLIENTE":
                    continue

                if not nombre:
                    skipped += 1
                    continue

                if siglas:
                    code = make_code_from_siglas(siglas)
                    if not code:
                        code = generate_code_from_name(nombre, used_codes)
                else:
                    code = generate_code_from_name(nombre, used_codes)

                if not code:
                    print(f"  [SKIP] Fila {row_num}: sin código válido — {nombre}")
                    skipped += 1
                    continue

                locality = "FOREIGN" if categoria.upper() == "FORANEO" else "LOCAL"
                is_active = estatus.upper() == "ACTIVO"
                payment_terms = parse_payment_terms(tpp_str)

                try:
                    if args.dry_run:
                        if code in used_codes:
                            print(f"  [DRY-SKIP] {code}: {nombre} (ya existe)")
                            skipped += 1
                        else:
                            print(f"  [DRY-INS ] {code}: {nombre}")
                            used_codes.add(code)
                            inserted += 1
                        continue

                    result = conn.execute(
                        text("""
                            INSERT INTO customers (
                                code, business_name, customer_type, locality,
                                is_active, payment_terms_days, currency,
                                created_at, updated_at
                            )
                            VALUES (
                                :code, :business_name, 'COMPANY', :locality,
                                :is_active, :payment_terms, 'MXN',
                                NOW(), NOW()
                            )
                            ON CONFLICT (code) DO NOTHING
                            RETURNING customer_id
                        """),
                        {
                            "code": code,
                            "business_name": nombre,
                            "locality": locality,
                            "is_active": is_active,
                            "payment_terms": payment_terms,
                        },
                    )
                    new_row = result.fetchone()

                    if new_row is None:
                        print(f"  [SKIP] {code}: {nombre} (ya existe)")
                        skipped += 1
                        continue

                    customer_id: int = new_row[0]
                    used_codes.add(code)

                    rfc = clean_rfc(rfc_raw)
                    legal_name = (
                        direccion
                        if direccion and not is_vacio(direccion)
                        else nombre
                    )

                    if is_valid_rfc(rfc) and legal_name:
                        conn.execute(
                            text("""
                                INSERT INTO customer_tax_data (
                                    customer_id, rfc, legal_name, zip_code, is_default
                                )
                                VALUES (:cid, :rfc, :legal_name, '00000', true)
                                ON CONFLICT (customer_id, rfc) DO NOTHING
                            """),
                            {"cid": customer_id, "rfc": rfc, "legal_name": legal_name},
                        )

                    contact_name = contacto if not is_vacio(contacto) else ""
                    phone_val = telefono if not is_vacio(telefono) else None
                    email_val = (
                        email_raw
                        if email_raw and not is_vacio(email_raw)
                        else None
                    )

                    if contact_name or phone_val or email_val:
                        full_name = contact_name if contact_name else nombre
                        conn.execute(
                            text("""
                                INSERT INTO customer_contacts (
                                    customer_id, full_name, phone, email, is_primary
                                )
                                VALUES (:cid, :full_name, :phone, :email, true)
                            """),
                            {
                                "cid": customer_id,
                                "full_name": full_name,
                                "phone": phone_val,
                                "email": email_val,
                            },
                        )

                    conn.commit()
                    inserted += 1
                    print(f"  [OK  ] {code}: {nombre}")

                except Exception as exc:
                    if not args.dry_run:
                        conn.rollback()
                    print(f"  [ERR ] Fila {row_num} ({nombre}): {exc}")
                    errors += 1

    print("-" * 60)
    print(f"Resultado: {inserted} insertados | {skipped} omitidos | {errors} errores")


if __name__ == "__main__":
    main()
