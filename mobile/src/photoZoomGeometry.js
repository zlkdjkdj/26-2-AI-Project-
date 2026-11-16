export function fittedSize(view, photo) {
  if (!view.width || !view.height || !photo.width || !photo.height) return { width: 0, height: 0 };
  const factor = Math.min(view.width / photo.width, view.height / photo.height);
  return { width: photo.width * factor, height: photo.height * factor };
}
export function clampPosition(view, base, scale, x, y) {
  const width = base.width * scale, height = base.height * scale;
  return {
    x: width <= view.width ? (view.width - width) / 2 : Math.min(0, Math.max(view.width - width, x)),
    y: height <= view.height ? (view.height - height) / 2 : Math.min(0, Math.max(view.height - height, y)),
  };
}
export function zoomAtCenter(view, base, current, nextScale, dx = 0, dy = 0) {
  const scale = Math.max(1, Math.min(4, nextScale));
  const x = current.x + dx - base.width * (scale - current.scale) / 2;
  const y = current.y + dy - base.height * (scale - current.scale) / 2;
  return { scale, ...clampPosition(view, base, scale, x, y) };
}
