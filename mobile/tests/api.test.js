import test from "node:test";
import assert from "node:assert/strict";
import { cameraRequest, serverAddress } from "../src/api.js";

test("only private networks accept plain HTTP; public hosts require HTTPS", () => {
  assert.equal(serverAddress("http://100.100.10.5:8000"), "http://100.100.10.5:8000");
  assert.equal(
    serverAddress(" http://192.168.0.10:8000/ "),
    "http://192.168.0.10:8000",
  );
  assert.equal(serverAddress("http://10.0.0.4:8000"), "http://10.0.0.4:8000");
  assert.equal(
    serverAddress("https://camera.example.com"),
    "https://camera.example.com",
  );
  for (const value of [
    "file:///secret",
    "http://public.example.com",
    "http://1.2.3.4",
    "http://172.32.0.4",
    "http://192.168.0.4/path",
    "https://user:password@example.com",
    "https://example.com?token=x",
  ]) {
    assert.throws(() => serverAddress(value));
  }
});

test("camera bearer is header-only, native requests omit browser credentials", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://192.168.0.10:8000/api/homecam/device/frame");
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers.Authorization, "Bearer temporary-test-token");
    assert.equal(options.headers["Content-Type"], "image/jpeg");
    return { ok: true, json: async () => ({ received: true }) };
  });
  assert.deepEqual(
    await cameraRequest(
      "http://192.168.0.10:8000",
      "/api/homecam/device/frame",
      { token: "temporary-test-token", body: new Blob(["test"]) },
    ),
    { received: true },
  );
});

test("expired camera token retains HTTP status for stopping the camera", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: "연결 만료" }),
  }));
  await assert.rejects(
    cameraRequest("https://example.com", "/api/homecam/device/pause"),
    (error) => error.status === 401,
  );
});

test("camera frames can use the Expo file upload transport", async () => {
  const file = new Blob(["jpeg bytes"], { type: "image/jpeg" });
  let sent;
  const fetcher = async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ received: true }) };
  };
  await cameraRequest("http://192.168.0.10:8000", "/api/homecam/device/frame", {
    token: "temporary-test-token", body: file, fetcher,
  });
  assert.equal(sent.options.body, file);
  assert.equal(sent.options.headers["Content-Type"], "image/jpeg");
});
