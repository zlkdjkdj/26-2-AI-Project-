# 앗차차 발표자료

- `index.html`: 발표자료(19장). 이미지와 글꼴은 파일 안에 들어 있고, 시연 영상은 `assets/demo.mp4`를 불러옵니다. 폴더째로 열어야 영상이 재생됩니다.
- 조작: 방향키·Space로 넘김, F 전체화면, 시연 영상 장에서 V 영상 전체화면. 브라우저 인쇄(배경 그래픽 켜기)로 PDF 저장.

## 수정과 빌드

원본은 `src/index.src.html`입니다. 고친 뒤 다시 만듭니다.

```bash
python build.py               # index.html (영상은 assets/demo.mp4 참조)
python build.py --with-video  # index-single.html (영상까지 넣은 단일 파일, 저장소에는 올리지 않음)
```

글꼴은 `assets/fonts-sub/`의 SUIT 부분 글꼴(한글 약 2,500자)입니다. 원본은 `mobile/assets/fonts/`에 있습니다.

디자인 정리: unslop by Damir Sokolovsky (@heydamir), CC BY 4.0
