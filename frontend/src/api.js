// 개발에서는 같은 출처의 Vite 프록시를 사용합니다. 휴대폰에서도 PC의 API로 연결됩니다.
export const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export function validationMessage(item){
  const names={openings:'문·창문',furniture_measurements:'가구 실측',room_width:'방 가로',room_depth:'방 세로',wall_color:'벽지 색상',floor_color:'바닥 색상',concept:'컨셉',width_m:'실측 가로·폭',depth_m:'실측 세로',offset_m:'시작 위치'};
  const field=names[item.loc?.at(-1)]||item.loc?.at(-1)||'입력값';
  if(item.type==='extra_forbidden')return `${field}: 현재 서버가 지원하지 않는 항목입니다. 서버가 최신 버전인지 확인해 주세요.`;
  return `${field}: ${(item.msg||'입력값을 확인해 주세요.').replace(/^Value error, /,'')}`;
}
export async function request(path, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, { ...options, signal: controller.signal });
    const body = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(body.detail) ? body.detail.map(validationMessage).join('\n') : body.detail;
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
