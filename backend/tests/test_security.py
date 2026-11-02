import io
import time
import pytest
from PIL import Image, Jpeg2KImagePlugin
from fastapi.testclient import TestClient
from app import db, main, demo_access, security

TEST_CODE = "private-demo-test-code-2026-only"


@pytest.fixture
def private_app(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE_PATH", tmp_path / "private.db")
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path / "uploads")
    main.UPLOAD_DIR.mkdir()
    static = next(
        route.app
        for route in main.app.routes
        if getattr(route, "name", None) == "uploads"
    )
    monkeypatch.setattr(static, "directory", str(main.UPLOAD_DIR))
    monkeypatch.setattr(static, "all_directories", [str(main.UPLOAD_DIR)])
    monkeypatch.setenv("DEMO_ACCESS_CODE", TEST_CODE)
    monkeypatch.setenv("DETECTION_MODE", "mock")
    monkeypatch.setenv("ELECTRICAL_DETECTION_ENABLED", "false")
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with TestClient(main.app) as client:
        yield client


def unlock(client):
    response = client.post("/api/demo/unlock", json={"code": TEST_CODE})
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    return response


def scan(client, save=False):
    photo = io.BytesIO()
    Image.new("RGB", (80, 80), "white").save(photo, format="PNG")
    response = client.post(
        "/api/analyze/image",
        data={
            "target_type": "elderly",
            "space_type": "living_room",
            "save_image": str(save).lower(),
        },
        files={"file": ("test.png", photo.getvalue(), "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_locked_requests_fail_before_model_and_all_private_surfaces_are_guarded(
    private_app, monkeypatch
):
    def forbidden(*args, **kwargs):
        raise AssertionError("Must not decode an unauthenticated image")

    monkeypatch.setattr(main, "validate_image", forbidden)
    for path in (
        "/api/scans",
        "/api/scans/1",
        "/api/scans/1/report",
        "/api/scans/1/safety",
        "/api/targets",
        "/api/spaces",
        "/uploads/test.jpg",
        "/openapi.json",
    ):
        assert private_app.get(path).status_code == 401, path
    for path in (
        "/api/analyze/image",
        "/api/scans",
        "/api/interior/analyze-style",
        "/api/scans/1/interior/preview",
    ):
        assert private_app.post(path, content=b"not-a-photo").status_code == 401, path
    assert private_app.get("/api/demo/status").json()["unlocked"] is False


def test_code_is_not_an_account_and_is_not_returned_or_stored_in_plaintext(private_app):
    assert (
        private_app.post("/api/demo/unlock", json={"code": "틀린 코드"}).status_code
        == 401
    )
    assert (
        private_app.post(
            "/api/demo/unlock", json={"code": TEST_CODE, "role": "master"}
        ).status_code
        == 422
    )
    result = unlock(private_app)
    assert TEST_CODE not in result.text
    cookie = result.headers["set-cookie"].lower()
    assert (
        "httponly" in cookie and "samesite=lax" in cookie and "max-age=28800" in cookie
    )
    raw = private_app.cookies.get(demo_access.COOKIE)
    with db.connect() as con:
        row = con.execute("SELECT * FROM demo_sessions").fetchone()
        assert raw != row["token_hash"] and TEST_CODE not in str(dict(row))
    assert (
        private_app.post(
            "/api/auth/register",
            json={"email": "any@example.test", "password": "anything"},
        ).status_code
        == 404
    )
    assert demo_access.CURRENT_USER.get() is None


def test_csrf_origin_and_foreign_cookies_cannot_bypass_the_gate(private_app):
    unlock(private_app)
    csrf = private_app.headers.pop("X-CSRF-Token")
    assert (
        private_app.post(
            "/api/spaces", json={"name": "test", "space_type": "living_room"}
        ).status_code
        == 403
    )
    private_app.headers["X-CSRF-Token"] = csrf
    assert (
        private_app.post(
            "/api/demo/lock", headers={"Origin": "https://attacker.invalid"}
        ).status_code
        == 403
    )
    assert (
        private_app.post(
            "/api/spaces", json={"name": "test", "space_type": "living_room"}
        ).status_code
        == 201
    )
    with TestClient(main.app) as stranger:
        assert stranger.get("/api/scans").status_code == 401


def test_lock_all_expiry_and_code_rotation_invalidate_sessions(
    private_app, monkeypatch
):
    unlock(private_app)
    with TestClient(main.app) as second:
        unlock(second)
        assert private_app.post("/api/demo/lock-all").status_code == 200
        assert second.get("/api/scans").status_code == 401
    unlock(private_app)
    with db.connect() as con:
        con.execute("UPDATE demo_sessions SET expires_at=?", (time.time() - 1,))
    assert private_app.get("/api/scans").status_code == 401
    unlock(private_app)
    monkeypatch.setenv("DEMO_ACCESS_CODE", "different-private-presentation-code")
    assert private_app.get("/api/scans").status_code == 401


def test_unlock_rate_limit_and_invalid_origin(private_app):
    assert (
        private_app.post(
            "/api/demo/unlock",
            json={"code": TEST_CODE},
            headers={"Origin": "https://attacker.invalid"},
        ).status_code
        == 403
    )
    for _ in range(10):
        assert (
            private_app.post("/api/demo/unlock", json={"code": "incorrect"}).status_code
            == 401
        )
    assert (
        private_app.post("/api/demo/unlock", json={"code": TEST_CODE}).status_code
        == 429
    )


def test_upload_bound_applies_before_parser_for_header_and_chunked_body(
    private_app, monkeypatch
):
    unlock(private_app)

    def forbidden(*args, **kwargs):
        raise AssertionError("Must reject before image parsing")

    monkeypatch.setattr(main, "validate_image", forbidden)
    assert (
        private_app.post(
            "/api/analyze/image",
            content=b"x",
            headers={"Content-Length": str(10 * 1024 * 1024)},
        ).status_code
        == 413
    )
    monkeypatch.setattr(security, "MAX_UPLOAD_BYTES", 32)
    parts = (b"x" * (600 * 1024) for _ in range(2))
    assert private_app.post("/api/analyze/image", content=parts).status_code == 413
    with db.connect() as con:
        assert con.execute("SELECT count(*) FROM analysis_lease").fetchone()[0] == 0


def test_analysis_quota_and_global_admission(private_app, monkeypatch):
    unlock(private_app)
    active = security.lease()
    try:
        assert private_app.post("/api/analyze/image").status_code == 429
    finally:
        security.release(active)
    monkeypatch.setenv("ANALYSIS_PER_DAY", "1")
    # The rejected admission already consumed the first quota attempt.
    assert private_app.post("/api/analyze/image").status_code == 429


def test_private_photos_deletion_and_no_store(private_app):
    unlock(private_app)
    record = scan(private_app, save=True)
    url = record["image_url"]
    response = private_app.get(url)
    assert (
        response.status_code == 200 and response.headers["cache-control"] == "no-store"
    )
    with TestClient(main.app) as stranger:
        assert stranger.get(url).status_code == 401
    assert private_app.delete(f"/api/scans/{record['scan_id']}").status_code == 200
    assert private_app.get(url).status_code == 404
    assert private_app.get(f"/api/scans/{record['scan_id']}").status_code == 404
    with db.connect() as con:
        assert con.execute("SELECT count(*) FROM hazards").fetchone()[0] == 0


def test_retention_removes_old_photos_and_keeps_recent_data(private_app):
    from app.data_retention import cleanup

    unlock(private_app)
    old = scan(private_app, save=True)
    recent = scan(private_app)
    with db.connect() as con:
        con.execute(
            "UPDATE scans SET created_at='2000-01-01T00:00:00.000Z' WHERE id=?",
            (old["scan_id"],),
        )
    cleanup()
    assert private_app.get(f"/api/scans/{old['scan_id']}").status_code == 404
    assert private_app.get(old["image_url"]).status_code == 404
    assert private_app.get(f"/api/scans/{recent['scan_id']}").status_code == 200


def test_guardian_links_expire_rotate_revoke_and_cannot_analyze(private_app):
    unlock(private_app)
    created = private_app.post("/api/care/sessions", json={"consent": True}).json()
    owner = {"Authorization": "Bearer " + created["owner_token"]}
    guardian = {"Authorization": "Bearer " + created["guardian_token"]}
    with TestClient(main.app) as guest:
        response = guest.get("/api/care/guardian", headers=guardian)
        assert response.status_code == 200 and "latitude" not in response.json()
        assert guest.post("/api/analyze/image", headers=guardian).status_code == 401
        new = private_app.post("/api/care/guardian/rotate", headers=owner).json()
        assert guest.get("/api/care/guardian", headers=guardian).status_code == 401
        guardian = {"Authorization": "Bearer " + new["guardian_token"]}
        assert guest.get("/api/care/guardian", headers=guardian).status_code == 200
        private_app.post("/api/care/guardian/revoke", headers=owner)
        assert guest.get("/api/care/guardian", headers=guardian).status_code == 401
        new = private_app.post("/api/care/guardian/rotate", headers=owner).json()
        guardian = {"Authorization": "Bearer " + new["guardian_token"]}
        with db.connect() as con:
            con.execute("UPDATE care_sessions SET expires_at=?", (time.time() - 1,))
        assert guest.get("/api/care/guardian", headers=guardian).status_code == 401


def test_unsupported_image_parsers_are_not_called(private_app, monkeypatch):
    unlock(private_app)

    def unsupported(*args, **kwargs):
        raise AssertionError("JPEG2000 parser must never be called")

    monkeypatch.setattr(Jpeg2KImagePlugin.Jpeg2KImageFile, "_open", unsupported)
    header = b"\x00\x00\x00\x0cjP  \r\n\x87\n" + b"\x00" * 50
    response = private_app.post(
        "/api/analyze/image",
        data={"target_type": "elderly", "space_type": "living_room"},
        files={"file": ("bad.jp2", header, "image/jp2")},
    )
    assert response.status_code == 415


def test_generated_code_is_only_in_local_file(private_app, monkeypatch, tmp_path):
    monkeypatch.delenv("DEMO_ACCESS_CODE")
    monkeypatch.setenv("DEMO_CODE_FILE", str(tmp_path / "local-demo-code.txt"))
    demo_access.prepare()
    value = demo_access.access_code()
    assert len(value) >= 24
    assert value not in private_app.get("/api/demo/status").text
    demo_access.prepare()
    assert demo_access.access_code() == value
