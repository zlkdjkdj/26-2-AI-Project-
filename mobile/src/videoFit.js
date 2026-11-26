/** 화면(viewport)에 영상을 비율 그대로 담는 상자. 회전이 90·270도면 가로세로를 바꿔 계산한다. */
export function containBox(frame, viewport) {
  const { width, height, turn = 0 } = frame;
  if (!(width > 0 && height > 0 && viewport.width > 0 && viewport.height > 0)) return null;
  const sideways = Math.abs(turn) % 180 !== 0;
  const w = sideways ? height : width, h = sideways ? width : height;
  const scale = Math.min(viewport.width / w, viewport.height / h);
  const boxWidth = w * scale, boxHeight = h * scale;
  return { position: "absolute", width: boxWidth, height: boxHeight, left: (viewport.width - boxWidth) / 2, top: (viewport.height - boxHeight) / 2 };
}
