package com.atchacha.homecam.bridge;
import android.content.Context;
import android.graphics.*;
import android.net.Uri;
import ai.onnxruntime.*;
import java.io.*;
import java.nio.*;
import java.util.*;

/**
 * 콘센트·멀티탭 전용 탐지기. 공개 데이터(Zenodo 18835199)를 원본 단위로 나눠 YOLOv8n을 직접 미세조정한 모델이며
 * 앱에 포함되어 있어 다운로드가 필요 없다. 문장으로 찾는 DINO 방식보다 정확하고 약 0.3초로 빠르다.
 * 학습·평가 기록은 work/speedup/ 에 있다.
 */
public final class OfflineOutletDetector {
  private static final String ASSET = "outlet-yolov8n.onnx";
  private static final int SIZE = 640;
  // 학습 때의 클래스 순서: 0 콘센트, 1 멀티탭, 2 조명 스위치(스위치는 위험 판정에 쓰지 않아 결과에서 제외)
  private static final String[] TYPES = {"socket", "power_strip", null};
  // 검증 데이터에서 정한 문턱값(OUTLET_THRESHOLDS 참고)
  private static final float[] THRESHOLDS = {.30f, .30f, 2f};

  private static byte[] modelBytes(Context c) throws IOException {
    try (InputStream in = c.getAssets().open(ASSET); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] b = new byte[65536]; int n;
      while ((n = in.read(b)) != -1) out.write(b, 0, n);
      return out.toByteArray();
    }
  }
  private static final class Box { int cls; float score, x, y, w, h; }
  private static float iou(Box a, Box b) {
    float x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    float y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    float area = x * y;
    return area / (a.w * a.h + b.w * b.h - area + 1e-9f);
  }

  public static List<Map<String, Object>> detect(Context c, String uri) throws Exception {
    Uri imageUri = Uri.parse(uri);
    if (!"file".equals(imageUri.getScheme())) throw new IOException("사진 파일을 읽을 수 없습니다.");
    File image = new File(imageUri.getPath()).getCanonicalFile();
    if (!image.getPath().startsWith(c.getCacheDir().getCanonicalPath() + File.separator)) throw new IOException("앱에서 선택한 사진만 분석할 수 있습니다.");
    Bitmap original = BitmapFactory.decodeFile(image.getPath());
    if (original == null) throw new IOException("사진을 읽지 못했습니다.");
    int width = original.getWidth(), height = original.getHeight();
    List<Box> candidates = new ArrayList<>();
    OrtEnvironment env = OrtEnvironment.getEnvironment();
    try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
      options.setIntraOpNumThreads(2);
      options.setMemoryPatternOptimization(false);
      try (OrtSession session = env.createSession(modelBytes(c), options)) {
        float scale = SIZE / (float) Math.max(width, height);
        int rw = Math.round(width * scale), rh = Math.round(height * scale), px = (SIZE - rw) / 2, py = (SIZE - rh) / 2;
        Bitmap input = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(input);
        canvas.drawColor(Color.rgb(114, 114, 114));
        canvas.drawBitmap(original, new Rect(0, 0, width, height), new Rect(px, py, px + rw, py + rh), new Paint(Paint.FILTER_BITMAP_FLAG));
        int[] pixels = new int[SIZE * SIZE];
        input.getPixels(pixels, 0, SIZE, 0, 0, SIZE, SIZE);
        input.recycle();
        FloatBuffer values = ByteBuffer.allocateDirect(3 * SIZE * SIZE * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
        for (int channel = 0; channel < 3; channel++) for (int color : pixels) values.put(((color >> (16 - channel * 8)) & 255) / 255f);
        values.rewind();
        try (OnnxTensor tensor = OnnxTensor.createTensor(env, values, new long[]{1, 3, SIZE, SIZE});
             OrtSession.Result result = session.run(Collections.singletonMap(session.getInputNames().iterator().next(), tensor))) {
          OnnxTensor output = (OnnxTensor) result.get(0);
          long[] shape = output.getInfo().getShape();            // [1, 4 + 클래스 수, 앵커 수]
          int classes = (int) shape[1] - 4, anchors = (int) shape[2];
          if (classes != TYPES.length) throw new IOException("지원하지 않는 모델 출력입니다.");
          FloatBuffer data = output.getFloatBuffer();
          for (int i = 0; i < anchors; i++) {
            int cls = 0; float score = 0;
            for (int j = 0; j < classes; j++) { float q = data.get((4 + j) * anchors + i); if (q > score) { score = q; cls = j; } }
            if (score < THRESHOLDS[cls]) continue;
            float cx = data.get(i), cy = data.get(anchors + i), w = data.get(2 * anchors + i), h = data.get(3 * anchors + i);
            float x1 = Math.max(0, Math.min(width, (cx - w / 2 - px) / scale)), y1 = Math.max(0, Math.min(height, (cy - h / 2 - py) / scale));
            float x2 = Math.max(0, Math.min(width, (cx + w / 2 - px) / scale)), y2 = Math.max(0, Math.min(height, (cy + h / 2 - py) / scale));
            if (x2 - x1 < 2 || y2 - y1 < 2) continue;
            Box b = new Box(); b.cls = cls; b.score = score; b.x = x1 / width; b.y = y1 / height; b.w = (x2 - x1) / width; b.h = (y2 - y1) / height;
            candidates.add(b);
          }
        }
      }
    } finally { original.recycle(); }
    candidates.sort((a, b) -> Float.compare(b.score, a.score));
    List<Box> kept = new ArrayList<>();
    for (Box b : candidates) {
      boolean overlap = false;
      for (Box k : kept) if (k.cls == b.cls && iou(k, b) > .45f) { overlap = true; break; }
      if (!overlap) { kept.add(b); if (kept.size() == 20) break; }
    }
    List<Map<String, Object>> out = new ArrayList<>();
    for (Box b : kept) {
      if (TYPES[b.cls] == null) continue;
      Map<String, Object> item = new HashMap<>();
      item.put("object_type", TYPES[b.cls]);
      item.put("confidence", (double) b.score);
      item.put("bbox", Arrays.asList((double) b.x, (double) b.y, (double) b.w, (double) b.h));
      item.put("source", "outlet_yolo");
      out.add(item);
    }
    return out;
  }
}
