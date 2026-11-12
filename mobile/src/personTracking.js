/** Smooth consecutive normalized detections without predicting a person's position. */
export function advancePersonTrack(previous, detection, elapsedMs) {
  if (!detection || detection.error) return null;
  const keys = ["x", "y", "width", "height", "frameWidth", "frameHeight"];
  if (keys.some((key) => !Number.isFinite(detection[key])) || detection.width <= 0 ||
      detection.height <= 0 || detection.frameWidth <= 0 || detection.frameHeight <= 0) return null;
  if (!previous || previous.frameWidth !== detection.frameWidth || previous.frameHeight !== detection.frameHeight ||
      !Number.isFinite(elapsedMs) || elapsedMs <= 0 || elapsedMs > 500) return { ...detection };
  const alpha = 1 - Math.exp(-elapsedMs / 110);
  const result = { ...detection };
  for (const key of ["x", "y", "width", "height"]) result[key] = previous[key] + (detection[key] - previous[key]) * alpha;
  return result;
}
