#!/usr/bin/env python3
"""
supabase-relay.py — Relay TCP local para conectar Docker → Supabase.

Necesario porque Docker/WSL2 no puede completar el handshake TLS con Supabase
directamente. Este script corre en Windows (fuera de Docker) y actúa como
puente: Docker se conecta a host.docker.internal:5433 → este relay →
aws-1-us-west-2.pooler.supabase.com:5432.

Uso:
    python scripts/supabase-relay.py
    python scripts/supabase-relay.py --port 5433  # puerto local (default: 5433)

Dejar corriendo mientras se usa el stack de desarrollo.
"""
import socket
import threading
import argparse
import sys

REMOTE_HOST = "aws-1-us-west-2.pooler.supabase.com"
REMOTE_PORT = 5432
DEFAULT_LOCAL_PORT = 5433


def pipe(src: socket.socket, dst: socket.socket) -> None:
    try:
        while True:
            data = src.recv(8192)
            if not data:
                break
            dst.sendall(data)
    except OSError:
        pass
    finally:
        try:
            src.close()
        except OSError:
            pass
        try:
            dst.close()
        except OSError:
            pass


def relay(client: socket.socket) -> None:
    try:
        server = socket.create_connection((REMOTE_HOST, REMOTE_PORT), timeout=15)
    except OSError as e:
        print(f"[ERROR] No se pudo conectar a {REMOTE_HOST}:{REMOTE_PORT}: {e}")
        client.close()
        return

    t1 = threading.Thread(target=pipe, args=(client, server), daemon=True)
    t2 = threading.Thread(target=pipe, args=(server, client), daemon=True)
    t1.start()
    t2.start()


def main() -> None:
    parser = argparse.ArgumentParser(description="Supabase TCP relay para Docker en Windows")
    parser.add_argument("--port", type=int, default=DEFAULT_LOCAL_PORT,
                        help=f"Puerto local a escuchar (default: {DEFAULT_LOCAL_PORT})")
    args = parser.parse_args()

    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        listener.bind(("0.0.0.0", args.port))
    except OSError as e:
        print(f"[ERROR] No se pudo escuchar en puerto {args.port}: {e}")
        sys.exit(1)

    listener.listen(20)
    print(f"[OK] Supabase relay activo: localhost:{args.port} → {REMOTE_HOST}:{REMOTE_PORT}")
    print(f"     Docker usa: host.docker.internal:{args.port}")
    print(f"     Ctrl+C para detener.\n")

    try:
        while True:
            client, addr = listener.accept()
            threading.Thread(target=relay, args=(client,), daemon=True).start()
    except KeyboardInterrupt:
        print("\n[INFO] Relay detenido.")
    finally:
        listener.close()


if __name__ == "__main__":
    main()
