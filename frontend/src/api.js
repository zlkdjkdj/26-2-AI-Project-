// 개발에서는 같은 출처의 Vite 프록시를 사용합니다. 휴대폰에서도 PC의 API로 연결됩니다.
export const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function request(path, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, { ...options, signal: controller.signal });
    const body = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(body.detail) ? body.detail.map(item => item.msg).join(', ') : body.detail;
      throw new Error(detail || '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('응답 시간이 초과되었습니다. 점검 이력을 확인한 후 다시 시도하세요.');
    if (error instanceof TypeError) throw new Error('서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인하세요.');
    throw error;
  } finally { clearTimeout(timeout); }
}
export function imageUrl(path) { return path ? `${API}${path}` : null; }
