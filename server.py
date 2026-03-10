#!/usr/bin/env python3
"""Simple local web server for the CRBL fight clock."""

from __future__ import annotations

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "0.0.0.0"
PORT = 8000
BASE_DIR = Path(__file__).resolve().parent


class ClockRequestHandler(SimpleHTTPRequestHandler):
    """Serve files from the repository folder regardless of launch cwd."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), ClockRequestHandler)
    print(f"CRBL clock available at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
