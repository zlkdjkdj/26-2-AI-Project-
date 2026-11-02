"""One private presentation code; no registration, accounts, or role escalation."""

import hashlib
import hmac
import os
import secrets
import time
from contextvars import ContextVar
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from .db import connect

router = APIRouter(prefix="/api/demo", tags=["시연 잠금"])
CURRENT_USER = ContextVar("demo_presenter", default=None)
COOKIE = "atchacha_demo_session"


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def user():
    account = CURRENT_USER.get()
    if account is None:
        raise HTTPException(401, "시연 코드로 잠금을 해제하세요.")
    return account


def require_presenter():
    return user()


def code_file():
    from . import db

    return Path(
        os.getenv(
            "DEMO_CODE_FILE", str(db.DATABASE_PATH.parent / "demo-access-code.txt")
        )
    )


def access_code():
    value = os.getenv("DEMO_ACCESS_CODE", "").strip()
    if not value:
        try:
            value = code_file().read_text(encoding="utf-8").strip()
        except OSError:
            return ""
    return value if len(value) >= 16 else ""


def prepare():
    if os.getenv("DEMO_ACCESS_CODE"):
        if not access_code():
            raise RuntimeError("DEMO_ACCESS_CODE must have at least 16 characters.")
        return
    path = code_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        if not access_code():
            raise RuntimeError("The local presentation code is invalid.")
        return
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        output.write(secrets.token_urlsafe(24))


def migrate(con):
    columns = {r["name"] for r in con.execute("PRAGMA table_info(care_sessions)")}
    if "expires_at" not in columns:
        con.execute(
            "ALTER TABLE care_sessions ADD COLUMN expires_at REAL NOT NULL DEFAULT 0"
        )
    con.executescript("""
      CREATE TABLE IF NOT EXISTS demo_sessions (
        token_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL,
        code_fingerprint TEXT NOT NULL, expires_at REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS security_limits (
        bucket TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS analysis_lease (
        slot INTEGER PRIMARY KEY CHECK(slot=1),token TEXT NOT NULL,expires_at REAL NOT NULL
      );
    """)


def authenticate(token):
    if not token or len(token) > 100:
        return None
    code = access_code()
    if not code:
        return None
    with connect() as con:
        row = con.execute(
            "SELECT csrf_token,code_fingerprint FROM demo_sessions WHERE token_hash=? AND expires_at>?",
            (digest(token), time.time()),
        ).fetchone()
    if not row or not hmac.compare_digest(row["code_fingerprint"], digest(code)):
        return None
    return {"id": 1, "role": "presenter", "csrf_token": row["csrf_token"]}


class Unlock(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=128)


@router.get("/status")
def status(request: Request):
    account = authenticate(request.cookies.get(COOKIE))
    return {
        "unlocked": bool(account),
        "csrf_token": account["csrf_token"] if account else None,
        "expires_in_hours": 8,
        "retention_days": max(1, int(os.getenv("DATA_RETENTION_DAYS", "90"))),
    }


@router.post("/unlock")
def unlock(payload: Unlock, request: Request, response: Response):
    code = access_code()
    if not code or not hmac.compare_digest(digest(payload.code.strip()), digest(code)):
        raise HTTPException(401, "시연 코드가 올바르지 않습니다.")
    raw, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    with connect() as con:
        old = request.cookies.get(COOKIE)
        if old:
            con.execute("DELETE FROM demo_sessions WHERE token_hash=?", (digest(old),))
        con.execute(
            "INSERT INTO demo_sessions VALUES(?,?,?,?)",
            (digest(raw), csrf, digest(code), time.time() + 8 * 3600),
        )
    secure = (
        os.getenv("DEMO_COOKIE_SECURE", "false").lower() == "true"
        or request.url.scheme == "https"
    )
    response.set_cookie(
        COOKIE,
        raw,
        max_age=8 * 3600,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    return {
        "unlocked": True,
        "csrf_token": csrf,
        "expires_in_hours": 8,
        "retention_days": max(1, int(os.getenv("DATA_RETENTION_DAYS", "90"))),
    }


@router.post("/lock")
def lock(request: Request, response: Response):
    with connect() as con:
        con.execute(
            "DELETE FROM demo_sessions WHERE token_hash=?",
            (digest(request.cookies.get(COOKIE, "")),),
        )
    from .analysis_service import clear_cache

    clear_cache()
    response.delete_cookie(COOKIE, path="/")
    return {"unlocked": False}


@router.post("/lock-all")
def lock_all(response: Response):
    with connect() as con:
        con.execute("DELETE FROM demo_sessions")
    from .analysis_service import clear_cache

    clear_cache()
    response.delete_cookie(COOKIE, path="/")
    return {"unlocked": False}
