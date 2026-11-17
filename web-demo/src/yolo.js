// YOLOv8s 전·후처리. mobile의 OfflinePhotoDetector.java 로직을 순수 함수로 옮긴 것(브라우저/Node 공용).
export const CLASSES = ("person bicycle car motorcycle airplane bus train truck boat traffic_light fire_hydrant stop_sign parking_meter bench bird cat dog horse sheep cow elephant bear zebra giraffe backpack umbrella handbag tie suitcase frisbee skis snowboard sports_ball kite baseball_bat baseball_glove skateboard surfboard tennis_racket bottle wine_glass cup fork knife spoon bowl banana apple sandwich orange broccoli carrot hot_dog pizza donut cake chair couch potted_plant bed dining_table toilet tv laptop mouse remote keyboard cell_phone microwave oven toaster sink refrigerator book clock vase scissors teddy_bear hair_drier toothbrush").split(" ");

export const INPUT = 640;
export const ANCHORS = 8400;
const TABLE = 60;
const TABLE_TILE_CLASSES = new Set([56, 57, 59, 60]); // chair, couch, bed, dining_table
const MAX_BOXES = 50;

export function letterbox(width, height) {
  const scale = INPUT / Math.max(width, height);
  const rw = Math.round(width * scale);
  const rh = Math.round(height * scale);
  return { scale, rw, rh, px: Math.trunc((INPUT - rw) / 2), py: Math.trunc((INPUT - rh) / 2) };
}

// data: [1,84,8400] 평탄화(채널 우선). source: 원본 이미지 안의 픽셀 영역 {left,top,right,bottom}.
export function decodeOutput(data, source, image, tilesOnly = false) {
  const lb = letterbox(source.right - source.left, source.bottom - source.top);
  const out = [];
  for (let i = 0; i < ANCHORS; i++) {
    let cls = 0, score = 0;
    for (let j = 0; j < 80; j++) {
      const q = data[(j + 4) * ANCHORS + i];
      if (q > score) { score = q; cls = j; }
    }
    if ((tilesOnly && !TABLE_TILE_CLASSES.has(cls)) || score < (cls === TABLE ? 0.24 : 0.35)) continue;
    const cx = data[i], cy = data[ANCHORS + i], w = data[2 * ANCHORS + i], h = data[3 * ANCHORS + i];
    const clampX = v => Math.max(source.left, Math.min(source.right, v));
    const clampY = v => Math.max(source.top, Math.min(source.bottom, v));
    const x1 = clampX(source.left + (cx - w / 2 - lb.px) / lb.scale);
    const y1 = clampY(source.top + (cy - h / 2 - lb.py) / lb.scale);
    const x2 = clampX(source.left + (cx + w / 2 - lb.px) / lb.scale);
    const y2 = clampY(source.top + (cy + h / 2 - lb.py) / lb.scale);
    if (x2 - x1 < 2 || y2 - y1 < 2) continue;
    out.push({ cls, score, x: x1 / image.width, y: y1 / image.height, w: (x2 - x1) / image.width, h: (y2 - y1) / image.height });
  }
  return out;
}

export function iou(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const area = x * y;
  return area / (a.w * a.h + b.w * b.h - area + 1e-9);
}

// 큰 탁자가 하단에 보이지 않으면 좌우 타일을 추가 추론한다.
export function needsTableTiles(candidates) {
  return !candidates.some(c => c.cls === TABLE && c.w * c.h >= 0.10 && c.y + c.h >= 0.65);
}

export function tileRects(width, height) {
  const tileWidth = Math.max(1, Math.round(width * 0.72));
  const top = Math.max(0, Math.round(height * 0.25));
  return [
    { left: 0, top, right: tileWidth, bottom: height },
    { left: width - tileWidth, top, right: width, bottom: height },
  ];
}

export function finalize(candidates) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const box of sorted) {
    if (kept.some(k => k.cls === box.cls && iou(k, box) > 0.45)) continue;
    kept.push(box);
    if (kept.length === MAX_BOXES) break;
  }
  return kept.map(b => ({ object_type: CLASSES[b.cls], confidence: b.score, bbox: [b.x, b.y, b.w, b.h] }));
}
