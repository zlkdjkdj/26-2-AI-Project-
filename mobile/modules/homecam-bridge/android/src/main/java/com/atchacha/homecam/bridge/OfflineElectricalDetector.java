package com.atchacha.homecam.bridge;
import android.content.Context;
import android.app.ActivityManager;
import android.graphics.*;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import ai.onnxruntime.*;
import java.io.*;
import java.nio.*;
import java.util.*;
import java.util.concurrent.*;

/** Optional existing Grounding DINO model; fixed tokenized prompts, no network during inference. */
public final class OfflineElectricalDetector {
  private static final String URL="https://huggingface.co/onnx-community/grounding-dino-tiny-ONNX/resolve/ff690b0a8050566c290287545bd059350f3e9096/onnx/model_quantized.onnx";
  private static final String HASH="70bf2d3310d1ae73769c96a71e00cbf2861eb33a1f4d97d84a108a7bf02c03c9";
  private static final long SIZE=203824675L, MAX=220000000L;
  private static final String[] KINDS={"electric_wire","socket","power_strip","electric_plug","wet_floor","rug"};
  private static final long[][] TOKENS={{101,5992,5830,1012,5992,13307,1012,2373,6167,1012,102},{101,5992,13307,1012,5992,5830,1012,2373,6167,1012,102},{101,2373,6167,1012,5992,13307,1012,5992,5830,1012,102},{101,5992,13354,1012,5992,13307,1012,2373,6167,1012,102},{101,4954,2723,1012,2300,1012,102},{101,20452,10135,1012,102}};
  // Individual prompts avoid the lower class confidence observed with a combined prompt.
  private static final String[] FURNITURE_KINDS={"electric_fan","chair","desk","dining_table"};
  private static final long[][] FURNITURE_TOKENS={{101,5470,1012,102},{101,3242,1012,102},{101,4624,1012,102},{101,2795,1012,102}};
  private static final float[] FURNITURE_THRESHOLDS={.50f,.38f,.50f,.50f};
  // 종류별 문턱값(KINDS 순서: 전선, 콘센트, 멀티탭, 플러그, 물기, 러그). 콘센트·멀티탭은 시험 사진 115장으로 점검해
  // 0.35 → 0.45로 올렸다(콘센트 F1 0.55 → 0.59, 멀티탭은 오탐 56건 → 34건). 바닥은 기존 0.48을 유지한다.
  private static final float[] KIND_THRESHOLDS={.35f,.45f,.45f,.35f,.48f,.48f};
  // 가구 질의는 선풍기 1개만 실행한다. 의자·책상·테이블은 기본 모델(YOLO)이 이미 찾고, 책상은 위험 규칙도 테이블과 같다.
  // 12번이던 추론이 9번으로 줄어 시간과 발열이 약 25% 줄어든다(질의 1번의 비용은 질의 내용과 상관없이 거의 같다).
  private static final int FURNITURE_PASSES=1;
  // 기기 열 단계가 보통(MODERATE) 이상이면 남은 추론을 건너뛰고 지금까지의 결과만 돌려준다(앱 종료·발열 방지).
  private static boolean thermalStop(Context c) {
    if(Build.VERSION.SDK_INT<29)return false;
    PowerManager pm=(PowerManager)c.getSystemService(Context.POWER_SERVICE);
    return pm!=null && pm.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_MODERATE;
  }
  private static File model(Context c) { return new File(c.getFilesDir(),"photo-electrical-v1.onnx"); }
  public static boolean supported(Context c) {
    ActivityManager.MemoryInfo info=new ActivityManager.MemoryInfo();
    ((ActivityManager)c.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(info);
    return info.totalMem >= 5L * 1024 * 1024 * 1024;
  }
  // 병렬 실행은 끈다. S25 실측(2026-11-24): 병렬이면 앱 메모리가 6.2GB까지 올라 시스템이 LOW_MEMORY로 앱을 종료했고,
  // 순차 실행은 3.4GB에서 33.9초에 정상 종료됐다. 속도 이득보다 종료 위험이 커서 항상 순차로 실행한다.
  public static boolean parallelSupported(Context c) {
    return false;
  }
  // 추가 모델은 실행 중 메모리를 크게 쓴다. 시작 전 여유가 이 값보다 작으면 건너뛰고 기본 결과만 보여 준다.
  private static final long MIN_AVAILABLE_BYTES = 1536L * 1024 * 1024;
  private static boolean enoughMemory(Context c) {
    ActivityManager.MemoryInfo info=new ActivityManager.MemoryInfo();
    ((ActivityManager)c.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(info);
    return !info.lowMemory && info.availMem >= MIN_AVAILABLE_BYTES;
  }
  public static boolean ready(Context c) {try {File f=model(c);return f.isFile()&&f.length()==SIZE&&HASH.equals(OfflinePhotoDetector.digest(f));}catch(Exception e){return false;}}
  public static void download(Context c) throws Exception {OfflinePhotoDetector.downloadFile(URL,model(c),HASH,MAX);}
  public static void remove(Context c) throws IOException {File f=model(c);if(f.exists()&&!f.delete())throw new IOException("전기 모델을 삭제하지 못했습니다.");}
  static final class Box {String type;float score,x,y,w,h;List<String> alternatives=new ArrayList<>();}
  static float iou(Box a, Box b){float x=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));float y=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));float area=x*y;return area/(a.w*a.h+b.w*b.h-area+1e-9f);}
  private static FloatBuffer normalize(int[] colors) {
    FloatBuffer pixels=ByteBuffer.allocateDirect(3*800*800*4).order(ByteOrder.nativeOrder()).asFloatBuffer();
    float[] means={.485f,.456f,.406f},std={.229f,.224f,.225f};
    for(int channel=0;channel<3;channel++)for(int color:colors)pixels.put(((((color>>(16-channel*8))&255)/255f)-means[channel])/std[channel]);pixels.rewind();return pixels;
  }
  public static List<Map<String,Object>> detect(Context c,String uri,boolean parallel) throws Exception {
    if(!supported(c))throw new IOException("이 기기는 추가 위험 탐지 모델의 메모리가 부족합니다. 전기설비와 바닥 상태를 직접 확인해 주세요.");
    if(!ready(c))throw new IOException("전기 위험 탐지 모델을 먼저 다운로드해 주세요.");
    if(!enoughMemory(c))throw new IOException("기기의 남은 메모리가 부족해 추가 점검을 건너뛰었습니다. 다른 앱을 닫고 다시 시도해 주세요.");
    Uri u=Uri.parse(uri);if(!"file".equals(u.getScheme()))throw new IOException("사진 파일을 읽을 수 없습니다.");
    File image=new File(u.getPath()).getCanonicalFile();if(!image.getPath().startsWith(c.getCacheDir().getCanonicalPath()+File.separator))throw new IOException("앱에서 선택한 사진만 분석할 수 있습니다.");
    Bitmap original=BitmapFactory.decodeFile(image.getPath());if(original==null)throw new IOException("사진을 읽지 못했습니다.");
    int width=original.getWidth(),height=original.getHeight();
    Bitmap scaled=Bitmap.createScaledBitmap(original,800,800,true);
    int n=800*800;int[] colors=new int[n];scaled.getPixels(colors,0,800,0,0,800,800);if(scaled!=original)scaled.recycle();
    double mean=0,sq=0;for(int color:colors){double g=.299*((color>>16)&255)+.587*((color>>8)&255)+.114*(color&255);mean+=g;sq+=g*g;}mean/=n;
    if(Math.sqrt(Math.max(0,sq/n-mean*mean))<.5){original.recycle();return new ArrayList<>();}
    FloatBuffer[] images=new FloatBuffer[3];images[0]=normalize(colors);
    float[][] regions={{0f,.35f,.65f,1f},{.35f,.35f,1f,1f}};
    for(int r=0;r<regions.length;r++){
      float[] a=regions[r];int left=Math.round(a[0]*width),top=Math.round(a[1]*height),right=Math.round(a[2]*width),bottom=Math.round(a[3]*height);
      Bitmap crop=Bitmap.createBitmap(original,left,top,right-left,bottom-top);Bitmap resized=Bitmap.createScaledBitmap(crop,800,800,true);
      int[] cropPixels=new int[n];resized.getPixels(cropPixels,0,800,0,0,800,800);images[r+1]=normalize(cropPixels);
      if(resized!=crop)resized.recycle();if(crop!=original)crop.recycle();
    }
    original.recycle();
    LongBuffer mask=ByteBuffer.allocateDirect(n*8).order(ByteOrder.nativeOrder()).asLongBuffer();for(int i=0;i<n;i++)mask.put(1);mask.rewind();
    OrtEnvironment env=OrtEnvironment.getEnvironment();List<Box> candidates=new ArrayList<>(), furnitureCandidates=new ArrayList<>();
    try(OrtSession.SessionOptions opts=new OrtSession.SessionOptions()){
      // 스레드는 2개로 둔다. 3개로 늘려 봤지만(S25 2026-11-24) 시간은 거의 줄지 않고 칩 온도만 59℃까지 올랐다.
      opts.setIntraOpNumThreads(2);
      // 메모리 패턴 사전 할당만 끈다. PC 측정에서 최대 메모리가 2.8GB에서 1.6GB로 내려갔다(S25 기존 3.4GB).
      // 메모리 풀(arena)까지 끄면 S25에서 분석이 34초에서 55초로 느려져서 풀은 켜 둔다.
      opts.setMemoryPatternOptimization(false);
      try(OrtSession session=env.createSession(model(c).getAbsolutePath(),opts);
          OnnxTensor maskTensor=OnnxTensor.createTensor(env,mask,new long[]{1,800,800});
          OnnxTensor fullImage=OnnxTensor.createTensor(env,images[0],new long[]{1,3,800,800});
          OnnxTensor leftImage=OnnxTensor.createTensor(env,images[1],new long[]{1,3,800,800});
          OnnxTensor rightImage=OnnxTensor.createTensor(env,images[2],new long[]{1,3,800,800})){
        OnnxTensor[] pixelTensors={fullImage,leftImage,rightImage};
        if(parallel && parallelSupported(c)) {
          ExecutorService workers=Executors.newFixedThreadPool(2);
          List<Future<List<Box>>> futures=new ArrayList<>();
          try {
            for(int i=0;i<KINDS.length+2+FURNITURE_PASSES;i++) { final int pass=i; futures.add(workers.submit(()->inferPass(env,session,pixelTensors,maskTensor,regions,width,height,pass))); }
            Exception failure=null; boolean interrupted=false;
            for(int i=0;i<futures.size();i++) {
              Future<List<Box>> future=futures.get(i);
              while(true) try { if(i<KINDS.length+2) candidates.addAll(future.get()); else furnitureCandidates.addAll(future.get()); break; }
              catch(InterruptedException e) { interrupted=true; }
              catch(ExecutionException e) { if(failure==null) failure=new IOException("물건 종류 추가 확인을 완료하지 못했습니다.",e.getCause()); break; }
            }
            if(interrupted) Thread.currentThread().interrupt();
            if(failure!=null) throw failure;
          } finally {
            workers.shutdown(); boolean interrupted=Thread.interrupted();
            while(!workers.isTerminated()) try { workers.awaitTermination(1,TimeUnit.SECONDS); } catch(InterruptedException e) { interrupted=true; }
            if(interrupted) Thread.currentThread().interrupt();
          }
        } else {
          boolean hot=false;
          for(int pass=0;pass<KINDS.length+2&&!hot;pass++) { if(thermalStop(c)){hot=true;break;} candidates.addAll(inferPass(env,session,pixelTensors,maskTensor,regions,width,height,pass)); }
          for(int i=0;i<FURNITURE_PASSES&&!hot;i++) { if(thermalStop(c)){hot=true;break;} furnitureCandidates.addAll(inferPass(env,session,pixelTensors,maskTensor,regions,width,height,KINDS.length+2+i)); }
        }
      }
    }
    candidates.sort((a,b)->Float.compare(b.score,a.score));List<Box> kept=new ArrayList<>();
    for(Box b:candidates){boolean overlap=false;for(Box existing:kept){float ratio=iou(existing,b);if(existing.type.equals(b.type)&&ratio>.45f){overlap=true;break;}if(!existing.type.equals(b.type)&&ratio>.75f){if(!existing.alternatives.contains(b.type))existing.alternatives.add(b.type);overlap=true;break;}}if(!overlap&&kept.size()<15)kept.add(b);}
    List<Map<String,Object>> result=new ArrayList<>();for(Box b:kept){Map<String,Object> item=new HashMap<>();item.put("object_type",b.type);item.put("confidence",(double)b.score);item.put("bbox",Arrays.asList((double)b.x,(double)b.y,(double)b.w,(double)b.h));item.put("alternative_types",b.alternatives);result.add(item);}
    furnitureCandidates.sort((a,b)->Float.compare(b.score,a.score));List<Box> furnitureKept=new ArrayList<>();
    for(Box b:furnitureCandidates){boolean overlap=false;for(Box existing:furnitureKept){float ratio=iou(existing,b);if(existing.type.equals(b.type)&&ratio>.45f){overlap=true;break;}if(!existing.type.equals(b.type)&&ratio>.65f){if(existing.score-b.score<.10f&&!existing.alternatives.contains(b.type))existing.alternatives.add(b.type);overlap=true;break;}}if(!overlap&&furnitureKept.size()<20)furnitureKept.add(b);}
    for(Box b:furnitureKept){Map<String,Object> item=new HashMap<>();item.put("object_type",b.type);item.put("confidence",(double)b.score);item.put("bbox",Arrays.asList((double)b.x,(double)b.y,(double)b.w,(double)b.h));item.put("alternative_types",b.alternatives);item.put("source","grounding_furniture");result.add(item);}return result;
  }
  private static List<Box> inferPass(OrtEnvironment env,OrtSession session,OnnxTensor[] pixelTensors,OnnxTensor maskTensor,float[][] regions,int width,int height,int pass) throws Exception {
    boolean furniture=pass>=KINDS.length+2;
    int furnitureIndex=pass-KINDS.length-2;
    int k=pass<KINDS.length?pass:0, variant=pass<KINDS.length||furniture?0:pass-KINDS.length+1;
    float[] region=variant==0?new float[]{0,0,1,1}:regions[variant-1];
    long[] tokens=furniture?FURNITURE_TOKENS[furnitureIndex]:TOKENS[k];
    long[] ones=new long[tokens.length];Arrays.fill(ones,1);long[] zeros=new long[tokens.length];
    List<Box> boxesFound=new ArrayList<>();
    try(OnnxTensor ids=OnnxTensor.createTensor(env,new long[][]{tokens});OnnxTensor types=OnnxTensor.createTensor(env,new long[][]{zeros});OnnxTensor attention=OnnxTensor.createTensor(env,new long[][]{ones})){
      Map<String,OnnxTensor> inputs=new HashMap<>();inputs.put("pixel_values",pixelTensors[variant]);inputs.put("pixel_mask",maskTensor);inputs.put("input_ids",ids);inputs.put("token_type_ids",types);inputs.put("attention_mask",attention);
      try(OrtSession.Result out=session.run(inputs)){
        FloatBuffer logits=((OnnxTensor)out.get("logits").get()).getFloatBuffer();FloatBuffer boxes=((OnnxTensor)out.get("pred_boxes").get()).getFloatBuffer();
        for(int i=0;i<900;i++){
          float raw=furniture?logits.get(i*256+1):Math.max(logits.get(i*256+1),logits.get(i*256+2));float score=(float)(1.0/(1.0+Math.exp(-Math.max(-40,Math.min(40,raw)))));if(score<(furniture?FURNITURE_THRESHOLDS[furnitureIndex]:KIND_THRESHOLDS[k]))continue;
          float cx=boxes.get(i*4),cy=boxes.get(i*4+1),w=boxes.get(i*4+2),h=boxes.get(i*4+3);
          float x1=Math.max(0,cx-w/2),y1=Math.max(0,cy-h/2),x2=Math.min(1,cx+w/2),y2=Math.min(1,cy+h/2);
          if((x2-x1)*width<3||(y2-y1)*height<3)continue;
          Box b=new Box();b.type=furniture?FURNITURE_KINDS[furnitureIndex]:KINDS[k];b.score=score;b.x=region[0]+x1*(region[2]-region[0]);b.y=region[1]+y1*(region[3]-region[1]);b.w=(x2-x1)*(region[2]-region[0]);b.h=(y2-y1)*(region[3]-region[1]);
          if(variant>0 && (b.w*b.h>.25f || Math.min(b.w,b.h)<.003f))continue;
          boxesFound.add(b);
        }
      }
    }
    return boxesFound;
  }
}
