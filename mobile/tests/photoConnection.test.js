import test from "node:test";
import assert from "node:assert/strict";
import { preferredPhotoServer } from "../src/photoConnection.js";
test("photo endpoint restores independently from camera pairing and normalizes the address", () => {
  assert.equal(
    preferredPhotoServer(
      " http://100.100.10.5:8000/ ",
      JSON.stringify({ server: "http://192.168.0.10:8000" }),
    ),
    "http://100.100.10.5:8000",
  );
  assert.equal(
    preferredPhotoServer(
      null,
      JSON.stringify({
        server: "http://192.168.0.10:8000",
        token: "not-an-endpoint",
      }),
    ),
    "http://192.168.0.10:8000",
  );
});
test("untrusted or corrupt saved endpoints cannot weaken the existing HTTP and credential policy", () => {
  for (const value of [
    "http://public.example.com",
    "https://user:password@example.com",
    "https://example.com?token=secret",
    "file:///private",
    "http://100.100.10.5:8000/v1/pair",
  ])
    assert.equal(preferredPhotoServer(value, "broken-json"), "");
  assert.equal(
    preferredPhotoServer(
      "http://public.example.com",
      JSON.stringify({ server: "https://private.example.com/" }),
    ),
    "https://private.example.com",
  );
  assert.equal(preferredPhotoServer({}, JSON.stringify({ server: 15 })), "");
});
