"""ASGI controls applied before multipart parsing and model execution."""

import asyncio
import hmac
import os
import re
import secrets
import time
from http.cookies import SimpleCookie
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse
from . import demo_access as auth
from .config import CORS_ORIGINS, MAX_UPLOAD_BYTES
from .db import connect

PUBLIC = {
    "/api/health",
    "/api/options",
    "/api/demo/status",
    "/api/demo/unlock",
    "/api/care/guardian",
}
AUTH_WRITES = {"/api/demo/unlock"}
SAFE = {"GET", "HEAD", "OPTIONS"}


def limit(category, identity, maximum, period):
    now = time.time()
    bucket = auth.digest(f"{category}:{identity}:{int(now // period)}")
    with connect() as con:
        con.execute("BEGIN IMMEDIATE")
        con.execute("DELETE FROM security_limits WHERE expires_at<?", (now,))
        row = con.execute(
            "SELECT hits FROM security_limits WHERE bucket=?", (bucket,)
        ).fetchone()
        if row and row["hits"] >= maximum:
            raise HTTPException(
                429,
                "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
                headers={"Retry-After": str(period)},
            )
        con.execute(
            "INSERT INTO security_limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1",
            (bucket, now + period),
        )


def lease():
    now = time.time()
    token = secrets.token_urlsafe(24)
    with connect() as con:
        con.execute("BEGIN IMMEDIATE")
        con.execute("DELETE FROM analysis_lease WHERE expires_at<?", (now,))
        if con.execute("SELECT 1 FROM analysis_lease").fetchone():
            raise HTTPException(
                429,
                "다른 이미지 분석이 진행 중입니다. 완료 후 다시 시도하세요.",
                headers={"Retry-After": "10"},
            )
        con.execute("INSERT INTO analysis_lease VALUES(1,?,?)", (token, now + 300))
    return token


def release(token):
    with connect() as con:
        con.execute("DELETE FROM analysis_lease WHERE token=?", (token,))


def is_image_request(path, method):
    return method == "POST" and (
        path in ("/api/analyze/image", "/api/scans", "/api/interior/analyze-style")
        or bool(re.fullmatch(r"/api/scans/[^/]+/interior/preview", path))
    )


class SecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope["path"].rstrip("/") or "/"
        method = scope["method"]
        headers = {k.lower(): v for k, v in scope.get("headers", [])}
        client = (scope.get("client") or ("unknown", 0))[0]
        token_context = None
        active_lease = None

        async def secured_send(message):
            nonlocal active_lease
            if message["type"] == "http.response.start":
                guarded = {
                    b"cache-control": b"no-store",
                    b"x-content-type-options": b"nosniff",
                    b"x-frame-options": b"DENY",
                    b"referrer-policy": b"no-referrer",
                }
                message["headers"] = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if k.lower() not in guarded
                ] + list(guarded.items())
                if path.startswith("/api/") or path.startswith("/uploads"):
                    message["headers"].append(
                        (
                            b"content-security-policy",
                            b"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
                        )
                    )
                if scope.get("scheme") == "https":
                    message["headers"].append(
                        (b"strict-transport-security", b"max-age=31536000")
                    )
            await send(message)
            if (
                message["type"] == "http.response.body"
                and not message.get("more_body", False)
                and active_lease
            ):
                token = active_lease
                active_lease = None
                await run_in_threadpool(release, token)

        try:
            if method not in SAFE:
                origin = headers.get(b"origin", b"").decode("latin-1")
                if origin and origin not in CORS_ORIGINS:
                    raise HTTPException(403, "허용되지 않은 요청 출처입니다.")
            if path in AUTH_WRITES:
                cap = 10
                await run_in_threadpool(limit, path, client, cap, 900)
            elif path in PUBLIC:
                await run_in_threadpool(limit, "public", client, 120, 60)
            if path not in PUBLIC:
                cookie = SimpleCookie()
                try:
                    cookie.load(headers.get(b"cookie", b"").decode("latin-1"))
                except Exception:
                    cookie = SimpleCookie()
                raw = cookie.get(auth.COOKIE)
                account = await run_in_threadpool(
                    auth.authenticate, raw.value if raw else None
                )
                if account is None:
                    raise HTTPException(401, "시연 코드로 잠금을 해제하세요.")
                token_context = auth.CURRENT_USER.set(account)
                scope.setdefault("state", {})["user"] = account
                if method not in SAFE:
                    csrf = headers.get(b"x-csrf-token", b"").decode("latin-1")
                    if not hmac.compare_digest(
                        csrf.encode(), account["csrf_token"].encode()
                    ):
                        raise HTTPException(
                            403, "보안 토큰이 유효하지 않습니다. 화면을 새로고침하세요."
                        )
                    await run_in_threadpool(
                        limit, "writes", str(account["id"]), 120, 60
                    )
                if is_image_request(path, method):
                    auth.require_presenter()
                    await run_in_threadpool(
                        limit,
                        "analysis-minute",
                        str(account["id"]),
                        int(os.getenv("ANALYSIS_PER_MINUTE", "6")),
                        60,
                    )
                    await run_in_threadpool(
                        limit,
                        "analysis-day",
                        str(account["id"]),
                        int(os.getenv("ANALYSIS_PER_DAY", "100")),
                        86400,
                    )
                    active_lease = await run_in_threadpool(lease)
            # Buffer at most the configured bytes before Starlette can spool any upload.
            if method not in SAFE:
                maximum = (
                    16 * 1024
                    if path in AUTH_WRITES or path.startswith("/api/demo/")
                    else MAX_UPLOAD_BYTES + 1024 * 1024
                )
                length = headers.get(b"content-length")
                if length:
                    try:
                        size = int(length)
                    except ValueError:
                        raise HTTPException(400, "요청 크기가 올바르지 않습니다.")
                    if size < 0:
                        raise HTTPException(400, "요청 크기가 올바르지 않습니다.")
                    if size > maximum:
                        raise HTTPException(
                            413, "요청 파일 또는 입력 크기가 제한을 초과했습니다."
                        )
                chunks = []
                total = 0
                try:
                    async with asyncio.timeout(20):
                        while True:
                            event = await receive()
                            if event["type"] == "http.disconnect":
                                return
                            data = event.get("body", b"")
                            total += len(data)
                            if total > maximum:
                                raise HTTPException(
                                    413,
                                    "요청 파일 또는 입력 크기가 제한을 초과했습니다.",
                                )
                            chunks.append(data)
                            if not event.get("more_body", False):
                                break
                except TimeoutError:
                    raise HTTPException(408, "업로드 시간이 초과되었습니다.")
                payload = b"".join(chunks)
                del chunks
                sent = False
                original_receive = receive

                async def bounded_receive():
                    nonlocal sent
                    if not sent:
                        sent = True
                        return {
                            "type": "http.request",
                            "body": payload,
                            "more_body": False,
                        }
                    return await original_receive()

                receive = bounded_receive
            await self.app(scope, receive, secured_send)
        except HTTPException as exc:
            response = JSONResponse(
                {
                    "detail": exc.detail,
                    "code": "demo_locked"
                    if exc.status_code == 401
                    else "request_rejected",
                },
                status_code=exc.status_code,
                headers=exc.headers,
            )
            await response(scope, receive, secured_send)
        finally:
            if active_lease:
                await run_in_threadpool(release, active_lease)
            if token_context is not None:
                auth.CURRENT_USER.reset(token_context)
