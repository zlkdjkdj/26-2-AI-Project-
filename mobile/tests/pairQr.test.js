import test from "node:test";
import assert from "node:assert/strict";
import { parsePairQr } from "../src/pairQr.js";

test("pair QR accepts only the intended app, private Tailscale address and one-time code", () => {
  const qr = { app: "atchacha-homecam", server: "http://100.119.10.5:8000", code: "012345" };
  assert.deepEqual(parsePairQr(JSON.stringify(qr)), { server: qr.server, code: qr.code });
  for (const invalid of ["bad json", JSON.stringify({ ...qr, server: "https://example.com" }), JSON.stringify({ ...qr, server: "http://192.168.0.1" }), JSON.stringify({ ...qr, code: "1" }), JSON.stringify({ ...qr, app: "other" })]) assert.throws(() => parsePairQr(invalid));
});
