import test from "node:test";
import assert from "node:assert/strict";
import { stripVideoOrientation } from "../src/sdpOrientation.js";

const sdp = [
  "v=0",
  "m=video 9 UDP/TLS/RTP/SAVPF 96",
  "a=extmap:3 urn:3gpp:video-orientation",
  "a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
  "a=rtpmap:96 H264/90000",
  "",
].join("\r\n");

test("영상 방향 확장 줄만 제거하고 나머지 줄은 그대로 둔다", () => {
  const out = stripVideoOrientation(sdp);
  assert.ok(!out.includes("video-orientation"));
  assert.ok(out.includes("abs-send-time"));
  assert.ok(out.includes("a=rtpmap:96 H264/90000"));
});

test("줄바꿈이 LF만 있어도 처리한다", () => {
  assert.ok(!stripVideoOrientation(sdp.replaceAll("\r\n", "\n")).includes("video-orientation"));
});
