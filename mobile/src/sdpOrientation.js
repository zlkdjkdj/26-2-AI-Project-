// 영상 방향 확장(CVO)을 협상하지 않으면 촬영 기기가 회전을 영상에 직접 적용해 보낸다.
// 받는 쪽은 회전값 없이 처음부터 바로 선 영상(예: 세로 720x1280)을 받으므로 화면비 계산이 단순해진다.
const CVO_LINE = /^a=extmap:\S+\s+urn:3gpp:video-orientation/i;

export function stripVideoOrientation(sdp) {
  return sdp
    .split(/\r?\n/)
    .filter((line) => !CVO_LINE.test(line))
    .join("\r\n");
}
