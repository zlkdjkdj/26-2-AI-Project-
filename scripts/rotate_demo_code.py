#!/usr/bin/env python3
"""Rotate the local demonstration code and invalidate every browser session."""

import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))


def main():
    from app import demo_access
    from app.db import connect, init_db

    if os.getenv("DEMO_ACCESS_CODE"):
        raise SystemExit(
            "DEMO_ACCESS_CODE is configured in the environment; change that private setting and restart instead."
        )
    init_db()
    path = demo_access.code_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + secrets.token_hex(6) + ".tmp")
    descriptor = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            file.write(secrets.token_urlsafe(24))
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    with connect() as con:
        con.execute("DELETE FROM demo_sessions")
    print("Presentation code rotated. All browser sessions are now invalid.")
    print(
        "Read the new code from the local backend/data/demo-access-code.txt file; do not commit it."
    )


if __name__ == "__main__":
    main()
