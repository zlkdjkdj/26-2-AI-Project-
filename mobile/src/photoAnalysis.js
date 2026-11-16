// Two independent models may run together only when the native memory gate allows it.
export async function runPhotoAnalysis({ bridge, uri, useExtra, parallel, onPartial }) {
  const settleExtra = () => Promise.resolve().then(() => bridge.detectElectricalPhoto(uri, parallel))
    .then(detections => ({ detections }), error => ({ error }));
  const extraPromise = useExtra && parallel ? settleExtra() : null;
  let local;
  try { local = await bridge.detectOfflinePhoto(uri); }
  catch (error) { if (extraPromise) await extraPromise; throw error; }
  if (!useExtra) return { detections: local, extraUsed: false };
  onPartial?.(local);
  const extra = await (extraPromise || settleExtra());
  if (extra.error) return { detections: local, extraUsed: false, extraError: extra.error.message || "추가 점검을 완료하지 못했습니다." };
  return { detections: [...local, ...extra.detections], extraUsed: true };
}
