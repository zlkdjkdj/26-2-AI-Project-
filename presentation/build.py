"""src/index.src.html 의 assets/ 참조(글꼴, 이미지, 영상)를 data URI로 넣어 단일 파일 index.html을 만든다.
미리보기 창이나 메신저처럼 상대 경로를 못 읽는 환경에서도 깨지지 않게 하기 위한 빌드다.
실행: python build.py            (영상은 assets/demo.mp4를 상대 경로로 유지)
      python build.py --with-video (영상까지 넣은 단일 파일 index-single.html, 약 15MB)"""
import base64, pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent
src = (root / 'src' / 'index.src.html').read_text(encoding='utf-8')
mime = {'.ttf': 'font/ttf', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4'}
cache = {}
with_video = '--with-video' in sys.argv
def uri(m):
    rel = m.group(2)
    if rel.endswith('.mp4') and not with_video:
        return m.group(0)
    p = root / rel
    if rel not in cache:
        cache[rel] = f"data:{mime[p.suffix.lower()]};base64," + base64.b64encode(p.read_bytes()).decode()
    return m.group(1) + cache[rel] + m.group(3)
out = re.sub(r'''((?:src|poster)=["']|url\(["']?)(assets/[^"')]+)(["')])''', uri, src)
name = 'index-single.html' if with_video else 'index.html'
(root / name).write_text(out, encoding='utf-8')
print('built', name, round(len(out) / 1e6, 1), 'MB; inlined', len(cache), 'files')
