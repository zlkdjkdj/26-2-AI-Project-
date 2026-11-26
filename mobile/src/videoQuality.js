// 홈캠 영상 화질 설정.
// 기본값은 연결 초반 비트레이트가 낮고, 화질이 떨어지면 해상도부터 줄여(예: 1280x720 → 960x528) 흐릿해진다.

export const VIDEO_BITRATE = { start: 2500, min: 1000, max: 4000 }; // kbps

const CODECS = /^(H264|VP8|VP9)$/i;

/**
 * 보는 쪽 offer에 비트레이트 힌트를 넣는다. 촬영 기기는 이 값을 받아 처음부터 높은 비트레이트로 보낸다.
 * (촬영 기기 앱을 새로 깔지 않아도 효과가 있다.)
 */
export function addBitrateHints(sdp, rate = VIDEO_BITRATE) {
  const lines = sdp.split(/\r?\n/);
  const video = new Set();
  for (const line of lines) {
    const m = /^a=rtpmap:(\d+)\s+([A-Za-z0-9]+)\/90000/.exec(line);
    if (m && CODECS.test(m[2])) video.add(m[1]);
  }
  const hint = `x-google-start-bitrate=${rate.start};x-google-min-bitrate=${rate.min};x-google-max-bitrate=${rate.max}`;
  const withFmtp = new Set();
  const out = lines.map((line) => {
    const m = /^a=fmtp:(\d+)\s+(.*)$/.exec(line);
    if (!m || !video.has(m[1])) return line;
    withFmtp.add(m[1]);
    return m[2].includes("x-google-") ? line : `${line};${hint}`;
  });
  // fmtp 줄이 없는 코덱(VP8 등)은 rtpmap 바로 뒤에 새로 만든다.
  const result = [];
  for (const line of out) {
    result.push(line);
    const m = /^a=rtpmap:(\d+)\s/.exec(line);
    if (m && video.has(m[1]) && !withFmtp.has(m[1])) result.push(`a=fmtp:${m[1]} ${hint}`);
  }
  return result.join("\r\n");
}

/** 촬영 기기의 송신 설정: 화질이 떨어질 때 해상도 대신 프레임을 줄이고, 최대 비트레이트를 올린다. */
export async function tuneVideoSender(peer, rate = VIDEO_BITRATE) {
  for (const sender of peer.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    const params = sender.getParameters();
    params.degradationPreference = "maintain-resolution";
    for (const encoding of params.encodings || []) {
      encoding.maxBitrate = rate.max * 1000;
      encoding.scaleResolutionDownBy = 1;
    }
    await sender.setParameters(params);
  }
}
