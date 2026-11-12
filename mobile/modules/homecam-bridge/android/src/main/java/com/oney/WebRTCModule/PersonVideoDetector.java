package com.oney.WebRTCModule;

import android.os.SystemClock;
import android.content.Context;
import com.facebook.react.bridge.ReactContext;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.pose.PoseDetection;
import com.google.mlkit.vision.pose.PoseDetector;
import com.google.mlkit.vision.pose.PoseLandmark;
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import org.webrtc.MediaStream;
import org.webrtc.VideoFrame;
import org.webrtc.VideoSink;
import org.webrtc.VideoTrack;

/** Reads only the received video track; no frames are saved or sent anywhere. */
public final class PersonVideoDetector implements VideoSink, AutoCloseable {
  private final ReactContext context;
  private final PoseDetector detector = PoseDetection.getClient(new PoseDetectorOptions.Builder()
      .setDetectorMode(PoseDetectorOptions.STREAM_MODE).build());
  private final AtomicBoolean processing = new AtomicBoolean(false);
  private final ExecutorService frames = Executors.newSingleThreadExecutor();
  private volatile boolean closed;
  private volatile long lastAttempt;
  private volatile long resultAt;
  private volatile boolean failed;
  private volatile Map<String, Double> current;
  private VideoTrack track; // accessed only on the WebRTC executor

  public PersonVideoDetector(Context context) {
    if (!(context instanceof ReactContext)) throw new IllegalStateException("React context is unavailable");
    this.context = (ReactContext) context;
  }

  public void start(String streamId) throws Exception {
    boolean attached = ThreadUtils.submitToExecutor(() -> {
      if (closed) return false;
      WebRTCModule module = context.getNativeModule(WebRTCModule.class);
      MediaStream stream = module == null ? null : module.getStreamForReactTag(streamId);
      if (stream != null && !stream.videoTracks.isEmpty()) {
        track = stream.videoTracks.get(0);
        track.addSink(this);
        return true;
      }
      return false;
    }).get(3, TimeUnit.SECONDS);
    if (!attached) throw new IllegalStateException("영상 트랙을 찾을 수 없습니다.");
  }

  @Override public void onFrame(VideoFrame frame) {
    long now = SystemClock.elapsedRealtime();
    if (closed || now - lastAttempt < 250 || !processing.compareAndSet(false, true)) return;
    lastAttempt = now;
    frame.retain();
    try { frames.execute(() -> processFrame(frame, now)); }
    catch (RejectedExecutionException error) { frame.release(); processing.set(false); }
  }

  private void processFrame(VideoFrame frame, long capturedAt) {
    if (closed) { frame.release(); processing.set(false); return; }
    VideoFrame.I420Buffer data = null;
    try {
      data = frame.getBuffer().toI420();
      int width = data.getWidth(), height = data.getHeight(), rotation = frame.getRotation();
      byte[] nv21 = toNv21(data);
      int outWidth = rotation == 90 || rotation == 270 ? height : width;
      int outHeight = rotation == 90 || rotation == 270 ? width : height;
      InputImage image = InputImage.fromByteArray(nv21, width, height, rotation, InputImage.IMAGE_FORMAT_NV21);
      detector.process(image).addOnSuccessListener(pose -> {
        if (closed) return;
        failed = false;
        if (SystemClock.elapsedRealtime() - capturedAt > 1500) { current = null; return; }
        float minX = Float.MAX_VALUE, minY = Float.MAX_VALUE, maxX = -Float.MAX_VALUE, maxY = -Float.MAX_VALUE;
        int count = 0;
        for (PoseLandmark p : pose.getAllPoseLandmarks()) {
          if (p.getInFrameLikelihood() < .5f) continue;
          float x = p.getPosition().x, y = p.getPosition().y;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); count++;
        }
        if (count < 4 || maxX <= minX || maxY <= minY) { current = null; return; }
        float padX = (maxX - minX) * .18f, padY = (maxY - minY) * .12f;
        double left = Math.max(0, (minX - padX) / outWidth), top = Math.max(0, (minY - padY) / outHeight);
        double right = Math.min(1, (maxX + padX) / outWidth), bottom = Math.min(1, (maxY + padY) / outHeight);
        if (right <= left || bottom <= top) { current = null; return; }
        Map<String, Double> box = new HashMap<>();
        box.put("x", left); box.put("y", top); box.put("width", right-left); box.put("height", bottom-top);
        box.put("frameWidth", (double) outWidth); box.put("frameHeight", (double) outHeight);
        current = box; resultAt = capturedAt;
      }).addOnFailureListener(error -> { current = null; failed = true; }).addOnCompleteListener(task -> processing.set(false));
    } catch (Throwable error) {
      current = null; failed = true; processing.set(false);
    } finally { if (data != null) data.release(); frame.release(); }
  }

  private static byte[] toNv21(VideoFrame.I420Buffer src) {
    int w = src.getWidth(), h = src.getHeight(), cw = (w + 1) / 2, ch = (h + 1) / 2;
    byte[] out = new byte[w * h + cw * ch * 2];
    ByteBuffer y = src.getDataY(), u = src.getDataU(), v = src.getDataV();
    int y0 = y.position(), u0 = u.position(), v0 = v.position(), i = 0;
    for (int row = 0; row < h; row++) for (int col = 0; col < w; col++) out[i++] = y.get(y0 + row * src.getStrideY() + col);
    for (int row = 0; row < ch; row++) for (int col = 0; col < cw; col++) {
      out[i++] = v.get(v0 + row * src.getStrideV() + col);
      out[i++] = u.get(u0 + row * src.getStrideU() + col);
    }
    return out;
  }

  public Map<String, Double> result() {
    if (!closed && failed) { Map<String, Double> error = new HashMap<>(); error.put("error", 1.0); return error; }
    return closed || SystemClock.elapsedRealtime() - resultAt > 1500 ? null : current;
  }
  @Override public void close() {
    closed = true; current = null; frames.shutdown();
    ThreadUtils.runOnExecutor(() -> { if (track != null) { track.removeSink(this); track = null; } });
    detector.close();
  }
}
