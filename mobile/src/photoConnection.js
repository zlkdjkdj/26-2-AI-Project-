import { serverAddress } from "./api.js";
export const PHOTO_SERVER_STORAGE = "atchacha.photo.server";
// Only restore endpoint-only addresses accepted by the existing network policy.
export function preferredPhotoServer(saved, legacy) {
  const candidates = [saved];
  try {
    candidates.push(JSON.parse(legacy || "null")?.server);
  } catch {}
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    try {
      return serverAddress(candidate);
    } catch {}
  }
  return "";
}
