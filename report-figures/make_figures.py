"""보고서용 AI 모델 그래프 5종을 만든다.
수치는 work/*.json(측정 기록)과 docs/service-introduction.md, OfflineElectricalDetector.java의 설정값을 옮긴 것이다.
실행: python make_figures.py   (matplotlib 필요)
"""
import json
import pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.patches import FancyBboxPatch

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORK = ROOT / "work"
OUT = pathlib.Path(__file__).resolve().parent

for name in ("malgun.ttf", "malgunbd.ttf"):
    fm.fontManager.addfont(rf"C:\Windows\Fonts\{name}")
plt.rcParams.update({
    "font.family": "Malgun Gothic",
    "axes.unicode_minus": False,
    "figure.dpi": 100,
    "savefig.dpi": 200,
})

# 검증된 팔레트(dataviz validate_palette.js 통과): 파랑·주황, 위험도용 3단 파랑
SURF, INK, INK2, MUTE, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#6b6a66", "#e6e5e1"
BLUE, ORANGE = "#2a78d6", "#eb6834"
ORD_LOW, ORD_MID, ORD_HIGH = "#6da7ec", "#2a78d6", "#104281"
PHOTO = {"power-strip.jpg": "콘센트·멀티탭 사진", "indoor.jpg": "실내 전경 사진"}


def load(name):
    return json.loads((WORK / name).read_text(encoding="utf-8"))


def new_fig(title, subtitle, source, h=6.2):
    fig = plt.figure(figsize=(10, h), facecolor=SURF)
    fig.text(0.06, 0.945, title, fontsize=20, fontweight="bold", color=INK, ha="left", va="top")
    fig.text(0.06, 0.885, subtitle, fontsize=11.5, color=INK2, ha="left", va="top")
    fig.text(0.06, 0.03, source, fontsize=8.5, color=MUTE, ha="left", va="bottom")
    return fig


def style_axes(ax, xgrid=False):
    ax.set_facecolor(SURF)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=INK2, length=0, labelsize=11)
    ax.grid(axis="x" if xgrid else "y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def grouped(ax, cats, a_vals, b_vals, a_label, b_label, unit="초", ymax=None):
    w = 0.34
    xs = range(len(cats))
    ax.bar([x - w / 2 for x in xs], a_vals, w, color=BLUE, edgecolor=SURF, linewidth=2, label=a_label)
    ax.bar([x + w / 2 for x in xs], b_vals, w, color=ORANGE, edgecolor=SURF, linewidth=2, label=b_label)
    top = ymax or max(a_vals + b_vals) * 1.25
    ax.set_ylim(0, top)
    ax.set_xlim(-0.6, len(cats) - 0.4)
    ax.set_xticks(list(xs))
    ax.set_xticklabels(cats, fontsize=12, color=INK)
    for i, (a, b) in enumerate(zip(a_vals, b_vals)):
        ax.text(i - w / 2, a + top * 0.015, f"{a:.1f}{unit}", ha="center", va="bottom", fontsize=11.5, color=INK, fontweight="bold")
        ax.text(i + w / 2, b + top * 0.015, f"{b:.1f}{unit}", ha="center", va="bottom", fontsize=11.5, color=INK, fontweight="bold")
        ax.text(i, max(a, b) + top * 0.1, f"{(1 - b / a) * 100:.0f}% 단축", ha="center", va="bottom", fontsize=12, color=INK2,
                bbox=dict(facecolor=SURF, edgecolor="none", pad=3), zorder=5)
    leg = ax.legend(frameon=False, loc="upper right", fontsize=11, labelcolor=INK2, ncol=2)
    for h in leg.legend_handles:
        h.set_linewidth(0)


# ---------- 그림 1: 전기설비 탐지 시간, 최적화 전/후 ----------
def fig1():
    rows = load("performance-after.json")
    fig = new_fig("전기설비 탐지 소요 시간: 최적화 전과 후",
                  "Grounding DINO 전기설비 탐지 단계, 같은 사진·같은 PC에서 측정 (결과는 전·후 동일)",
                  "출처: work/performance-after.json · PC CPU 서버 환경의 전체 모델 기준이며 모바일 앱의 측정값이 아님")
    ax = fig.add_axes([0.08, 0.14, 0.88, 0.64])
    style_axes(ax)
    cats = [PHOTO[r["image"]] for r in rows]
    grouped(ax, cats, [r["before_seconds"] for r in rows], [r["after_seconds"] for r in rows], "최적화 전", "최적화 후", ymax=60)
    ax.set_ylabel("소요 시간 (초)", color=INK2, fontsize=11)
    fig.savefig(OUT / "fig1_전기설비_탐지시간_전후.png", facecolor=SURF)
    plt.close(fig)


# ---------- 그림 2: CPU 스레드 수 비교 + 캐시 ----------
def fig2():
    rows = load("cpu6-comparison.json")
    cache = load("detection-cache-performance.json")
    t4 = {r["image"]: r["seconds"] for r in rows if r["threads"] == 4}
    t6 = {r["image"]: r["seconds"] for r in rows if r["threads"] == 6}
    imgs = list(t4)
    fig = new_fig("스레드 수와 캐시가 탐지 시간에 준 영향",
                  "Grounding DINO 전기설비 탐지 단계 · 모든 비교에서 출력 결과 동일",
                  "출처: work/cpu6-comparison.json, work/detection-cache-performance.json · PC CPU 서버 환경의 전체 모델 기준")
    ax = fig.add_axes([0.08, 0.14, 0.52, 0.64])
    style_axes(ax)
    grouped(ax, [PHOTO[i] for i in imgs], [t4[i] for i in imgs], [t6[i] for i in imgs], "스레드 4개", "스레드 6개", ymax=40)
    ax.set_ylabel("소요 시간 (초)", color=INK2, fontsize=11)
    # 캐시: 숫자 하나가 핵심이라 막대 대신 수치 타일로 표시
    tile = fig.add_axes([0.66, 0.14, 0.30, 0.64])
    tile.axis("off")
    tile.add_patch(FancyBboxPatch((0, 0), 1, 1, boxstyle="round,pad=0,rounding_size=0.04", transform=tile.transAxes,
                                  facecolor="#f3f2ee", edgecolor=GRID, linewidth=1))
    tile.text(0.08, 0.90, "같은 사진을 다시 분석할 때", transform=tile.transAxes, fontsize=12.5, color=INK, va="center", fontweight="bold")
    tile.text(0.08, 0.76, "처음 분석 (캐시 없음)", transform=tile.transAxes, fontsize=10.5, color=INK2, va="center")
    tile.text(0.08, 0.66, f"{cache['cold']['detection_seconds']:.1f}초", transform=tile.transAxes, fontsize=22, color=MUTE, va="center")
    tile.plot([0.08, 0.92], [0.55, 0.55], transform=tile.transAxes, color=GRID, linewidth=1)
    tile.text(0.08, 0.46, "다시 분석 (결과 캐시 적중)", transform=tile.transAxes, fontsize=10.5, color=INK2, va="center")
    tile.text(0.08, 0.34, f"{cache['repeat']['detection_seconds']:.4f}초", transform=tile.transAxes, fontsize=30, color=INK, va="center", fontweight="bold")
    tile.text(0.08, 0.13, "탐지 단계만 측정 · 결과 동일\n외부 AI 호출 없음", transform=tile.transAxes, fontsize=10, color=INK2, va="center", linespacing=1.6)
    fig.savefig(OUT / "fig2_스레드_캐시_비교.png", facecolor=SURF)
    plt.close(fig)


# ---------- 그림 3: 모델별 출력 문턱값 ----------
def fig3():
    items = [  # (라벨, 값, 모델)
        ("YOLOv8s · 테이블", 0.24, "yolo"),
        ("YOLOv8s · 그 외 일반 물체(79개 클래스)", 0.35, "yolo"),
        ("Grounding DINO · 전선·콘센트·멀티탭·플러그", 0.35, "dino"),
        ("Grounding DINO · 의자", 0.38, "dino"),
        ("Grounding DINO · 바닥(물기, 러그·매트)", 0.48, "dino"),
        ("Grounding DINO · 선풍기", 0.50, "dino"),
        ("Grounding DINO · 책상", 0.50, "dino"),
        ("Grounding DINO · 테이블", 0.50, "dino"),
    ]
    fig = new_fig("후보로 표시하는 신뢰도 문턱값",
                  "점수가 문턱값 이상이면 후보로 표시합니다. 정답 확률이 아니며 두 모델의 점수는 같은 척도가 아닙니다",
                  "출처: docs/service-introduction.md 'AI 탐지 기준', OfflinePhotoDetector.java, OfflineElectricalDetector.java · 중복 박스는 같은 종류에서 IoU 0.45 초과면 정리",
                  h=6.6)
    ax = fig.add_axes([0.40, 0.12, 0.56, 0.64])
    style_axes(ax, xgrid=True)
    n = len(items)
    ys = list(range(n))[::-1]
    for y, (label, v, m) in zip(ys, items):
        ax.barh(y, v, height=0.62, color=BLUE if m == "yolo" else ORANGE, edgecolor=SURF, linewidth=2)
        ax.text(v + 0.008, y, f"{v:.2f}", va="center", ha="left", fontsize=11.5, color=INK, fontweight="bold")
    ax.set_yticks(ys)
    ax.set_yticklabels([i[0] for i in items], fontsize=10.5, color=INK)
    ax.set_xlim(0, 0.62)
    ax.set_xlabel("신뢰도 문턱값 (이상)", color=INK2, fontsize=11)
    ax.legend(handles=[plt.Rectangle((0, 0), 1, 1, color=BLUE), plt.Rectangle((0, 0), 1, 1, color=ORANGE)],
              labels=["YOLOv8s (기본 모델)", "Grounding DINO Tiny (선택 모델)"], frameon=False, loc="lower left",
              bbox_to_anchor=(0.0, 1.01), ncol=2, fontsize=10.5, labelcolor=INK2)
    fig.savefig(OUT / "fig3_출력_문턱값.png", facecolor=SURF)
    plt.close(fig)


# ---------- 그림 4: 점수 규칙 ----------
def fig4():
    fig = new_fig("참고 안전점수 계산 규칙",
                  "위험 항목마다 점수를 깎고, 고위험 개수에 따라 최고점을 제한합니다 (안전 인증이 아닌 참고값)",
                  "출처: mobile/src/offlineSafety.js · '종류 확인 필요' 항목은 점수에 반영하지 않으며, 점수화할 항목이 없으면 산정을 보류")
    left = fig.add_axes([0.14, 0.40, 0.30, 0.38])
    right = fig.add_axes([0.62, 0.40, 0.30, 0.38])
    for ax in (left, right):
        style_axes(ax)
    cats = ["저위험", "중위험", "고위험"]
    ded = [5, 12, 25]
    bars = left.bar(cats, ded, width=0.6, color=[ORD_LOW, ORD_MID, ORD_HIGH], edgecolor=SURF, linewidth=2)
    for b, v in zip(bars, ded):
        left.text(b.get_x() + b.get_width() / 2, v + 0.6, f"-{v}점", ha="center", va="bottom", fontsize=12, color=INK, fontweight="bold")
    left.set_ylim(0, 31)
    left.set_title("항목당 차감", loc="left", fontsize=13, color=INK, pad=12)
    left.set_ylabel("차감 점수", color=INK2, fontsize=11)
    left.tick_params(axis="x", labelsize=11.5, labelcolor=INK)
    cats2 = ["0개", "1개", "2개 이상"]
    caps = [80, 60, 40]
    bars = right.bar(cats2, caps, width=0.6, color=[ORD_LOW, ORD_MID, ORD_HIGH], edgecolor=SURF, linewidth=2)
    for b, v in zip(bars, caps):
        right.text(b.get_x() + b.get_width() / 2, v + 1.5, f"{v}점", ha="center", va="bottom", fontsize=12, color=INK, fontweight="bold")
    right.set_ylim(0, 100)
    right.set_title("고위험 항목 수에 따른 최고점", loc="left", fontsize=13, color=INK, pad=12)
    right.set_ylabel("점수 상한", color=INK2, fontsize=11)
    right.set_xlabel("고위험 항목 수", color=INK2, fontsize=10.5)
    right.tick_params(axis="x", labelsize=11.5, labelcolor=INK)
    examples = ["계산 예시",
                "· 저위험 2개:  100 - 5 - 5 = 90  →  상한 80 적용  →  80점",
                "· 고위험 1개 + 중위험 1개:  100 - 25 - 12 = 63  →  상한 60 적용  →  60점",
                "· '종류 확인 필요' 항목만 있을 때:  점수 산정 보류"]
    fig.text(0.06, 0.255, examples[0], fontsize=12, color=INK, fontweight="bold", va="top")
    for i, t in enumerate(examples[1:]):
        fig.text(0.06, 0.208 - i * 0.045, t, fontsize=11.5, color=INK2, va="top")
    fig.savefig(OUT / "fig4_점수_계산_규칙.png", facecolor=SURF)
    plt.close(fig)


# ---------- 그림 5: 모델 사양 비교표 ----------
def fig5():
    fig = new_fig("사진 점검에 사용한 AI 모델 사양",
                  "두 모델 모두 공개된 사전 학습 가중치를 그대로 사용했습니다 (직접 학습·파인튜닝 없음)",
                  "출처: docs/service-introduction.md, mobile OfflinePhotoDetector.java·OfflineElectricalDetector.java, backend/models/grounding-dino/config.json",
                  h=7.4)
    ax = fig.add_axes([0.06, 0.07, 0.90, 0.78])
    ax.set_xlim(0, 100)
    ax.set_ylim(100, 0)
    ax.axis("off")
    cx = [0, 17, 58.5]
    rows = [
        ("역할", "일반 물체와 가구 탐지\n(기본 모델)", "전선·콘센트·멀티탭·바닥·일부 가구를\n글로 질의해 탐지 (선택 모델)"),
        ("모델 유형", "사전 학습 객체 탐지\nCOCO 80개 클래스", "사전 학습 텍스트 질의 탐지\nSwin 백본 + BERT, 인코더·디코더 6층"),
        ("입력", "640×640\n비율 유지, 남는 곳 회색 채움", "800×800\n전체 사진 + 하단 좌·우 영역"),
        ("출력", "[1, 84, 8400]\n박스 4값 + 클래스 점수 80개", "질의별 점수(logits)와 박스\n후보 900개"),
        ("후처리", "문턱값 0.35 (테이블 0.24)\n같은 종류 IoU 0.45 초과 정리", "질의별 0.35~0.50 (바닥 0.48)\n같은 종류 IoU 0.45 초과 정리"),
        ("모델 크기", "약 45MB", "약 204MB (앱 내 변환본)"),
        ("실행 위치", "기기 안, ONNX Runtime\n다운로드 후 오프라인", "기기 안, ONNX Runtime\nRAM 약 5GiB 미만 기기는 제한"),
    ]
    # 머리글
    ax.add_patch(plt.Rectangle((cx[1], 1.2), 2.2, 5.2, color=BLUE, lw=0))
    ax.text(cx[1] + 4, 3.8, "YOLOv8s", fontsize=15, fontweight="bold", color=INK, va="center")
    ax.add_patch(plt.Rectangle((cx[2], 1.2), 2.2, 5.2, color=ORANGE, lw=0))
    ax.text(cx[2] + 4, 3.8, "Grounding DINO Tiny", fontsize=15, fontweight="bold", color=INK, va="center")
    top = 9.0
    row_h = 11.2
    ax.plot([0, 100], [top, top], color=INK, lw=1.2)
    for i, (k, a, b) in enumerate(rows):
        y = top + i * row_h
        ax.text(cx[0] + 0.5, y + row_h / 2, k, fontsize=11.5, color=MUTE, va="center", fontweight="bold")
        ax.text(cx[1], y + row_h / 2, a, fontsize=11.2, color=INK, va="center", linespacing=1.55)
        ax.text(cx[2], y + row_h / 2, b, fontsize=11.2, color=INK, va="center", linespacing=1.55)
        ax.plot([0, 100], [y + row_h, y + row_h], color=GRID, lw=1)
    y_end = top + len(rows) * row_h
    ax.text(0.5, y_end + 5.5, "학습", fontsize=11.5, color=MUTE, va="center", fontweight="bold")
    ax.text(cx[1], y_end + 5.5, "이 프로젝트에서 직접 학습하거나 파인튜닝하지 않음 · 정확도(mAP 등) 지표는 아직 측정하지 않음",
            fontsize=11.2, color=INK, va="center")
    fig.savefig(OUT / "fig5_모델_사양_비교.png", facecolor=SURF)
    plt.close(fig)


if __name__ == "__main__":
    for f in (fig1, fig2, fig3, fig4, fig5):
        f()
    print("saved to", OUT)
    for p in sorted(OUT.glob("fig*.png")):
        print(p.name, p.stat().st_size // 1024, "KB")
