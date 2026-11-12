package com.atchacha.homecam.bridge;
import android.content.Context;
import android.app.ActivityManager;
import android.graphics.*;
import android.net.Uri;
import ai.onnxruntime.*;
import java.io.*;
import java.nio.*;
import java.util.*;

/** Optional existing Grounding DINO model; fixed tokenized prompts, no network during inference. */
public final class OfflineElectricalDetector {
  private static final String URL="https://huggingface.co/onnx-community/grounding-dino-tiny-ONNX/resolve/ff690b0a8050566c290287545bd059350f3e9096/onnx/model_quantized.onnx";
  private static final String HASH="70bf2d3310d1ae73769c96a71e00cbf2861eb33a1f4d97d84a108a7bf02c03c9";
  private static final long SIZE=203824675L, MAX=220000000L;
  private static final String[] KINDS={"electric_wire","socket","power_strip","electric_plug"};
  private static final long[][] TOKENS={{101,5992,5830,1012,5992,13307,1012,2373,6167,1012,102},{101,5992,13307,1012,5992,5830,1012,2373,6167,1012,102},{101,2373,6167,1012,5992,13307,1012,5992,5830,1012,102},{101,5992,13354,1012,5992,13307,1012,2373,6167,1012,102}};
  private static File model(Context c) { return new File(c.getFilesDir(),"photo-electrical-v1.onnx"); }
  public static boolean supported(Context c) {
    ActivityManager.MemoryInfo info=new ActivityManager.MemoryInfo();
    ((ActivityManager)c.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(info);
    return info.totalMem >= 5L * 1024 * 1024 * 1024;
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
  public static List<Map<String,Object>> detect(Context c,String uri) throws Exception {
    if(!supported(c))throw new IOException("이 기기는 전기 시험 모델의 메모리가 부족합니다. PC 서버 점검을 이용해 주세요.");
    if(!ready(c))throw new IOException("전기 위험 탐지 모델을 먼저 다운로드해 주세요.");
    Uri u=Uri.parse(uri);if(!"file".equals(u.getScheme()))throw new IOException("사진 파일을 읽을 수 없습니다.");
    File image=new File(u.getPath()).getCanonicalFile();if(!image.getPath().startsWith(c.getCacheDir().getCanonicalPath()+File.separator))throw new IOException("앱에서 선택한 사진만 분석할 수 있습니다.");
    Bitmap original=BitmapFactory.decodeFile(image.getPath());if(original==null)throw new IOException("사진을 읽지 못했습니다.");
    int width=original.getWidth(),height=original.getHeight();
    Bitmap scaled=Bitmap.createScaledBitmap(original,800,800,true);
    int n=800*800;int[] colors=new int[n];scaled.getPixels(colors,0,800,0,0,800,800);if(scaled!=original)scaled.recycle();
    double mean=0,sq=0;for(int color:colors){double g=.299*((color>>16)&255)+.587*((color>>8)&255)+.114*(color&255);mean+=g;sq+=g*g;}mean/=n;
    if(Math.sqrt(Math.max(0,sq/n-mean*mean))<.5){original.recycle();return new ArrayList<>();}
    FloatBuffer[] images=new FloatBuffer[3];images[0]=normalize(colors);
    float[][] regions={{0f,.35f,.6f,.85f},{.4f,.35f,1f,.85f}};
    for(int r=0;r<regions.length;r++){
      float[] a=regions[r];int left=Math.round(a[0]*width),top=Math.round(a[1]*height),right=Math.round(a[2]*width),bottom=Math.round(a[3]*height);
      Bitmap crop=Bitmap.createBitmap(original,left,top,right-left,bottom-top);Bitmap resized=Bitmap.createScaledBitmap(crop,800,800,true);
      int[] cropPixels=new int[n];resized.getPixels(cropPixels,0,800,0,0,800,800);images[r+1]=normalize(cropPixels);
      if(resized!=crop)resized.recycle();if(crop!=original)crop.recycle();
    }
    original.recycle();
    LongBuffer mask=ByteBuffer.allocateDirect(n*8).order(ByteOrder.nativeOrder()).asLongBuffer();for(int i=0;i<n;i++)mask.put(1);mask.rewind();
    OrtEnvironment env=OrtEnvironment.getEnvironment();List<Box> candidates=new ArrayList<>();
    try(OrtSession.SessionOptions opts=new OrtSession.SessionOptions()){
      opts.setIntraOpNumThreads(2);
      try(OrtSession session=env.createSession(model(c).getAbsolutePath(),opts);OnnxTensor maskTensor=OnnxTensor.createTensor(env,mask,new long[]{1,800,800})){
        for(int pass=0;pass<KINDS.length+2;pass++){
          int k=pass<KINDS.length?pass:0; int variant=pass<KINDS.length?0:pass-KINDS.length+1;
          float[] region=variant==0?new float[]{0,0,1,1}:regions[variant-1];
          long[] ones=new long[TOKENS[k].length];Arrays.fill(ones,1);long[] zeros=new long[TOKENS[k].length];
          try(OnnxTensor pixelTensor=OnnxTensor.createTensor(env,images[variant],new long[]{1,3,800,800});OnnxTensor ids=OnnxTensor.createTensor(env,new long[][]{TOKENS[k]});OnnxTensor types=OnnxTensor.createTensor(env,new long[][]{zeros});OnnxTensor attention=OnnxTensor.createTensor(env,new long[][]{ones})){
            Map<String,OnnxTensor> inputs=new HashMap<>();inputs.put("pixel_values",pixelTensor);inputs.put("pixel_mask",maskTensor);inputs.put("input_ids",ids);inputs.put("token_type_ids",types);inputs.put("attention_mask",attention);
            try(OrtSession.Result out=session.run(inputs)){
              FloatBuffer logits=((OnnxTensor)out.get("logits").get()).getFloatBuffer();FloatBuffer boxes=((OnnxTensor)out.get("pred_boxes").get()).getFloatBuffer();
              for(int i=0;i<900;i++){
                float raw=Math.max(logits.get(i*256+1),logits.get(i*256+2));float score=(float)(1.0/(1.0+Math.exp(-Math.max(-40,Math.min(40,raw)))));if(score<.35f)continue;
                float cx=boxes.get(i*4),cy=boxes.get(i*4+1),w=boxes.get(i*4+2),h=boxes.get(i*4+3);
                float x1=Math.max(0,cx-w/2),y1=Math.max(0,cy-h/2),x2=Math.min(1,cx+w/2),y2=Math.min(1,cy+h/2);
                if((x2-x1)*width<3||(y2-y1)*height<3)continue;
                Box b=new Box();b.type=KINDS[k];b.score=score;b.x=region[0]+x1*(region[2]-region[0]);b.y=region[1]+y1*(region[3]-region[1]);b.w=(x2-x1)*(region[2]-region[0]);b.h=(y2-y1)*(region[3]-region[1]);
                if(variant>0 && (b.w*b.h>.25f || Math.min(b.w,b.h)<.003f))continue;
                candidates.add(b);
              }
            }
          }
        }
      }
    }
    candidates.sort((a,b)->Float.compare(b.score,a.score));List<Box> kept=new ArrayList<>();
    for(Box b:candidates){boolean overlap=false;for(Box existing:kept){float ratio=iou(existing,b);if(existing.type.equals(b.type)&&ratio>.45f){overlap=true;break;}if(!existing.type.equals(b.type)&&ratio>.75f){if(!existing.alternatives.contains(b.type))existing.alternatives.add(b.type);overlap=true;break;}}if(!overlap&&kept.size()<15)kept.add(b);}
    List<Map<String,Object>> result=new ArrayList<>();for(Box b:kept){Map<String,Object> item=new HashMap<>();item.put("object_type",b.type);item.put("confidence",(double)b.score);item.put("bbox",Arrays.asList((double)b.x,(double)b.y,(double)b.w,(double)b.h));item.put("alternative_types",b.alternatives);result.add(item);}return result;
  }
}
