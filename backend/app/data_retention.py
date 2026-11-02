"""Private-demo record deletion and bounded retention without deleting accounts."""

import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from .db import connect

logger = logging.getLogger(__name__)


def remove_photo(url):
    if not url:
        return
    from . import main

    filename = url.rsplit("/", 1)[-1]
    if not re.fullmatch(r"[0-9a-f]{32}\.jpg", filename):
        return
    path = main.UPLOAD_DIR / filename
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Private photo cleanup deferred.")


def remove_scan(scan_id):
    with connect() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute(
            "SELECT image_url FROM scans WHERE id=?", (scan_id,)
        ).fetchone()
        if not row:
            return
        con.execute("DELETE FROM scans WHERE id=?", (scan_id,))
    remove_photo(row["image_url"])
    from .analysis_service import clear_cache

    clear_cache()


def cleanup():
    days = max(1, int(os.getenv("DATA_RETENTION_DAYS", "90")))
    cutoff = (
        (datetime.now(timezone.utc) - timedelta(days=days))
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    with connect() as con:
        rows = con.execute(
            "SELECT id FROM scans WHERE created_at<?", (cutoff,)
        ).fetchall()
    for row in rows:
        remove_scan(row["id"])
    now = time.time()
    with connect() as con:
        con.execute("DELETE FROM demo_sessions WHERE expires_at<?", (now,))
        con.execute("DELETE FROM security_limits WHERE expires_at<?", (now,))
        con.execute(
            "DELETE FROM care_sessions WHERE last_seen<?", (now - days * 86400,)
        )
    # Orphans cannot be read through a record; retry removal after transient failures.
    from . import main

    with connect() as con:
        used = {
            r["image_url"].rsplit("/", 1)[-1]
            for r in con.execute(
                "SELECT image_url FROM scans WHERE image_url IS NOT NULL"
            )
        }
    for path in main.UPLOAD_DIR.glob("*.jpg"):
        try:
            modified = path.stat().st_mtime
        except FileNotFoundError:
            continue
        if (
            re.fullmatch(r"[0-9a-f]{32}\.jpg", path.name)
            and path.name not in used
            and modified < now - 86400
        ):
            remove_photo("/uploads/" + path.name)
