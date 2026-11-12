/** Map a normalized, rotation-corrected video box into an RTCView viewport. */
export function mapPersonBox(box, frame, viewport, fit = "contain") {
  if (!box || !frame || !viewport || !["contain", "cover"].includes(fit)) return null;
  const { x, y, width, height } = box;
  const values = [x, y, width, height, frame.width, frame.height, viewport.width, viewport.height];
  if (values.some((value) => !Number.isFinite(value)) || width <= 0 || height <= 0 ||
      frame.width <= 0 || frame.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const left = Math.max(0, x), top = Math.max(0, y);
  const right = Math.min(1, x + width), bottom = Math.min(1, y + height);
  if (left >= right || top >= bottom) return null;
  const scale = (fit === "cover" ? Math.max : Math.min)(viewport.width / frame.width, viewport.height / frame.height);
  const displayWidth = frame.width * scale, displayHeight = frame.height * scale;
  const offsetX = (viewport.width - displayWidth) / 2, offsetY = (viewport.height - displayHeight) / 2;
  const x1 = Math.max(0, offsetX + left * displayWidth);
  const y1 = Math.max(0, offsetY + top * displayHeight);
  const x2 = Math.min(viewport.width, offsetX + right * displayWidth);
  const y2 = Math.min(viewport.height, offsetY + bottom * displayHeight);
  return x1 < x2 && y1 < y2 ? { left: x1, top: y1, width: x2 - x1, height: y2 - y1 } : null;
}
