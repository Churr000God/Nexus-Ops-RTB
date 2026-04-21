#!/usr/bin/env python3
"""Crea o actualiza el usuario administrador en la base de datos.

Uso (dentro del contenedor backend):
    python /app/scripts/create_admin_user.py --email foo@bar.com --password secret --role admin
"""

from __future__ import annotations

import argparse
import os
import sys

from passlib.context import CryptContext
from sqlalchemy import create_engine, text

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crea o actualiza usuario administrador."
    )
    parser.add_argument("--email", required=True, help="Email del usuario")
    parser.add_argument("--password", required=True, help="Contraseña en texto plano")
    parser.add_argument(
        "--role", default="admin", help="Rol del usuario (default: admin)"
    )
    args = parser.parse_args()

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("[ERR] Falta variable de entorno DATABASE_URL", file=sys.stderr)
        sys.exit(1)

    hashed = pwd_context.hash(args.password)
    engine = create_engine(db_url)

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                INSERT INTO users (id, email, hashed_password, role, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), :email, :hashed, :role, true, NOW(), NOW())
                ON CONFLICT (email) DO UPDATE SET
                    hashed_password = EXCLUDED.hashed_password,
                    role = EXCLUDED.role,
                    is_active = true,
                    updated_at = NOW()
                RETURNING email, role, is_active
            """),
            {"email": args.email, "hashed": hashed, "role": args.role},
        )
        row = result.fetchone()
        conn.commit()

    print(f"[ OK ] Usuario listo: {row[0]} | rol={row[1]} | activo={row[2]}")


if __name__ == "__main__":
    main()
