import { serverAddress } from "./api.js";

export function parsePairQr(data) {
  let value;
  try { value = JSON.parse(data); } catch { throw new Error("앗차차 연결 QR이 아닙니다."); }
  if (!value || typeof value.server !== "string" || typeof value.code !== "string") throw new Error("연결 QR의 내용을 확인해 주세요.");
  const server = serverAddress(value.server);
  const host = new URL(server).hostname.split(".").map(Number);
  if (value.app !== "atchacha-homecam" || !/^\d{6}$/.test(value.code) || host.length !== 4 || host[0] !== 100 || host[1] < 64 || host[1] > 127) {
    throw new Error("앗차차 Tailscale 연결 QR이 아닙니다.");
  }
  return { server, code: value.code };
}
