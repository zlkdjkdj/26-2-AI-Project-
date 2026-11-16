const furniture = new Set(["chair", "couch", "bed", "dining_table", "desk", "electric_fan"]);
const names = { chair: "의자", couch: "소파", bed: "침대", dining_table: "테이블", desk: "책상", electric_fan: "선풍기" };

// Strong overlap is required: objects next to one another must not be merged.
function overlapAffinity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 4 || b.length !== 4 || ![...a, ...b].every(Number.isFinite)) return 0;
  const [ax, ay, aw, ah] = a, [bx, by, bw, bh] = b;
  if (aw <= 0 || ah <= 0 || bw <= 0 || bh <= 0) return 0;
  const intersection = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const aa = aw * ah, ba = bw * bh;
  const iou = intersection / (aa + ba - intersection);
  if (iou < .45 && !(intersection / Math.min(aa, ba) >= .75 && intersection / Math.max(aa, ba) >= .35)) return 0;
  return iou;
}
export function sameObject(a, b) { return overlapAffinity(a, b) > 0; }

// Treat disagreement as uncertain; never turn two uncalibrated scores into a false certainty.
export function reconcileFurniture(detections) {
  const local = detections.filter(item => item.source !== "grounding_furniture").map(item => ({ ...item }));
  const checked = detections.filter(item => item.source === "grounding_furniture");
  const matched = new Set();
  for (const candidate of checked) {
    const options = [...new Set([candidate.object_type, ...(candidate.alternative_types || [])].filter(type => furniture.has(type)))];
    let index = -1, best = 0;
    local.forEach((item, i) => {
      if (matched.has(i) || !furniture.has(item.object_type)) return;
      const overlap = overlapAffinity(item.bbox, candidate.bbox);
      if (overlap > best) { best = overlap; index = i; }
    });
    if (index < 0) {
      if (options.length > 1) local.push({ ...candidate, object_type: "uncertain_furniture", alternative_types: options });
      else local.push(candidate);
      continue;
    }
    matched.add(index);
    const current = local[index];
    if (options.length === 1 && current.object_type === options[0]) {
      local[index] = { ...current, classification_confirmed: true };
    } else if (options.length === 1 && current.object_type === "dining_table" && options[0] === "desk") {
      local[index] = { ...candidate, classification_confirmed: true };
    } else {
      const alternatives = [...new Set([current.object_type, ...options])];
      local[index] = { ...current, object_type: "uncertain_furniture", alternative_types: alternatives, classification_confirmed: false };
    }
  }
  return local;
}

export function furnitureAlternatives(item) {
  return (item.alternative_types || []).map(type => names[type]).filter(Boolean);
}
