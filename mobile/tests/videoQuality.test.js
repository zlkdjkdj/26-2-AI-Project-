import test from "node:test";
import assert from "node:assert/strict";
import { addBitrateHints } from "../src/videoQuality.js";

const sdp = [
  "m=video 9 UDP/TLS/RTP/SAVPF 96 97 98",
  "a=rtpmap:96 VP8/90000",
  "a=rtpmap:97 rtx/90000",
  "a=fmtp:97 apt=96",
  "a=rtpmap:98 H264/90000",
  "a=fmtp:98 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
].join("\r\n");

test("H264 fmtp 뒤에 비트레이트 힌트를 붙인다", () => {
  const out = addBitrateHints(sdp);
  assert.match(out, /a=fmtp:98 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f;x-google-start-bitrate=2500;x-google-min-bitrate=1000;x-google-max-bitrate=4000/);
});

test("fmtp가 없는 VP8에는 새 fmtp 줄을 만들고 rtx는 건드리지 않는다", () => {
  const out = addBitrateHints(sdp);
  assert.match(out, /a=rtpmap:96 VP8\/90000\r\na=fmtp:96 x-google-start-bitrate=2500/);
  assert.match(out, /a=fmtp:97 apt=96\r\n/);
});

test("이미 힌트가 있으면 다시 붙이지 않는다", () => {
  const once = addBitrateHints(sdp);
  assert.equal(addBitrateHints(once), once);
});
