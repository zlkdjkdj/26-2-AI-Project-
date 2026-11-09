// @ts-check

/** @param {string} value */
export function serverAddress(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("http://192.168.0.10:8000 형식으로 PC 주소를 입력하세요.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  ) {
    throw new Error("경로나 인증정보 없이 서버 주소와 포트만 입력하세요.");
  }
  const octets = url.hostname.split(".").map(Number);
  const privateIPv4 =
    octets.length === 4 &&
    octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (octets[0] === 10 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  if (
    url.protocol === "http:" &&
    !privateIPv4 &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error(
      "HTTP는 사설 Wi-Fi 또는 Tailscale 주소에서만 사용하세요. 외부 서버는 HTTPS가 필요합니다.",
    );
  }
  return url.origin;
}

export class CameraRequestError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {string} server
 * @param {string} path
 * @param {{token?: string, body?: Blob, signal?: AbortSignal, json?: Record<string, unknown>, fetcher?: typeof fetch, method?: string}} options
 */
export async function cameraRequest(
  server,
  path,
  { token, body, signal, json, fetcher = fetch, method = "POST" } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 10000);
  try {
    /** @type {Record<string, string>} */
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json) headers["Content-Type"] = "application/json";
    else if (body) headers["Content-Type"] = "image/jpeg";
    const response = await fetcher(`${server}${path}`, {
      method,
      headers,
      body: json ? JSON.stringify(json) : body,
      signal: controller.signal,
      credentials: "omit",
    });
    const data = await response.json();
    if (!response.ok) {
      throw new CameraRequestError(
        typeof data.detail === "string" ? data.detail : "요청을 확인해 주세요.",
        response.status,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("연결이 중지되었거나 서버 응답 시간이 초과되었습니다.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
