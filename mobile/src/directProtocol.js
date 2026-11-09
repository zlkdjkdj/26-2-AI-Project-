export const CAMERA_STORAGE = 'atchacha.direct.camera.v1';
export const VIEWER_STORAGE = 'atchacha.direct.viewer.v1';
const secret = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function isTailnet(ip) {
  const parts = ip.split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
    && Number(parts[0]) === 100 && Number(parts[1]) >= 64 && Number(parts[1]) <= 127;
}
export function isTailnetMedia(ip) {
  if (isTailnet(ip)) return true;
  // Tailscale's exact fd7a:115c:a1e0::/48; reject arbitrary ULA, scopes and hosts.
  if (!/^fd7a:115c:a1e0:/i.test(ip) || !/^[0-9a-f:]+$/i.test(ip)) return false;
  const halves = ip.split('::');
  if (halves.length > 2) return false;
  const groups = halves.flatMap((half) => half ? half.split(':') : []);
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return false;
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}
export function hasTailnetCandidate(sdp) {
  return sdp.split(/\r?\n/).some((line) => line.startsWith('a=candidate:') && isTailnetMedia(line.split(/\s+/)[4] || ''));
}
export function directOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !isTailnet(url.hostname) || url.port !== '8787'
    || url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('앗차차 촬영 기기의 Tailscale 주소만 연결할 수 있습니다.');
  return url.origin;
}
export function parseDirectQr(raw) {
  if (typeof raw !== 'string' || raw.length > 1024) throw new Error('홈캠 등록 QR을 확인하세요.');
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('촬영 기기의 새 등록 QR을 스캔하세요.'); }
  if (data.app !== 'atchacha-direct' || data.version !== 1 || !secret(data.id) || !secret(data.pair))
    throw new Error('촬영 기기의 새 등록 QR을 스캔하세요.');
  return { origin: directOrigin(data.origin), id: data.id, pair: data.pair };
}
export function savedCamera(value) {
  if (!value || !secret(value.id) || !secret(value.token)) throw new Error('기기를 다시 등록하세요.');
  return { id: value.id, token: value.token, origin: directOrigin(value.origin) };
}
export async function directRequest(origin, path, { token, json, method, signal } = {}, fetcher = fetch) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort);
  const timer = setTimeout(abort, 8000);
  try {
    const response = await fetcher(`${directOrigin(origin)}${path}`, {
      method: method || (json ? 'POST' : 'GET'),
      credentials: 'omit', redirect: 'error', signal: controller.signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) },
      ...(json ? { body: JSON.stringify(json) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || '촬영 기기 연결을 확인하세요.'), { status: response.status });
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('연결 시간이 초과되었습니다. 두 기기의 Tailscale과 촬영 모드를 확인하세요.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

// Restrict media candidates to the encrypted Tailnet, with no public STUN/TURN dependency.
export function tailnetSdp(sdp, network) {
  const lines = sdp.split(/\r?\n/);
  const candidates = lines.filter((line) => line.startsWith('a=candidate:') && isTailnetMedia(line.split(/\s+/)[4] || ''));
  if (!candidates.length) {
    if (network?.tailnetInterface === false) throw new Error('이 휴대폰의 Tailscale 연결이 꺼져 있습니다. Tailscale 연결 후 다시 시도하세요.');
    const addresses = lines.filter((line) => line.startsWith('a=candidate:')).map((line) => line.split(/\s+/)[4] || '');
    const families = `/I4${addresses.filter((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip)).length}/I6${addresses.filter((ip) => ip.includes(':')).length}`;
    const diagnostic = (network ? `T${Number(network.tailnetInterface)}/V${Number(network.vpnNetwork)}/C${addresses.length}` : `C${addresses.length}`) + families;
    throw new Error(`Tailscale 영상 경로 수집에 실패했습니다. 두 휴대폰의 앱을 업데이트한 뒤 완전히 종료하고 다시 실행하세요. [${diagnostic}]`);
  }
  return lines.filter((line) => !line.startsWith('a=candidate:') || candidates.includes(line)).join('\r\n');
}
