package com.atchacha.homecam.bridge;
import android.content.Context;
import android.graphics.*;
import android.net.Uri;
import ai.onnxruntime.*;
import java.io.*;
import java.net.*;
import java.nio.*;
import java.security.MessageDigest;
import java.util.*;

public final class OfflinePhotoDetector {
  private static final String URL = "https://huggingface.co/Kalray/yolov8/resolve/9e0af089be9c2f172e4fd9b724805f8b6514854e/yolov8s.onnx";
  private static final String HASH = "1bd2afeed7a85188e295875b3936a6f08df5a7671457ece9077f3b9b8daee6d6";
  private static final long MAX = 55L * 1024 * 1024;
  private static final String[] CLASSES = ("person bicycle car motorcycle airplane bus train truck boat traffic_light fire_hydrant stop_sign parking_meter bench bird cat dog horse sheep cow elephant bear zebra giraffe backpack umbrella handbag tie suitcase frisbee skis snowboard sports_ball kite baseball_bat baseball_glove skateboard surfboard tennis_racket bottle wine_glass cup fork knife spoon bowl banana apple sandwich orange broccoli carrot hot_dog pizza donut cake chair couch potted_plant bed dining_table toilet tv laptop mouse remote keyboard cell_phone microwave oven toaster sink refrigerator book clock vase scissors teddy_bear hair_drier toothbrush").split(" ");
  private static File model(Context c) { return new File(c.getFilesDir(), "photo-yolov8s-v1.onnx"); }
  static String digest(File f) throws Exception {
    MessageDigest d = MessageDigest.getInstance("SHA-256");
    try (InputStream in = new FileInputStream(f)) { byte[] b = new byte[65536]; int n; while ((n=in.read(b))!=-1) d.update(b,0,n); }
    StringBuilder s=new StringBuilder(); for(byte b:d.digest()) s.append(String.format(Locale.ROOT,"%02x",b & 255)); return s.toString();
  }
  public static boolean ready(Context c) { try { File f=model(c); return f.isFile() && f.length() <= MAX && HASH.equals(digest(f)); } catch(Exception e) { return false; } }
  public static void download(Context c) throws Exception { downloadFile(URL, model(c), HASH, MAX); }
  static void downloadFile(String source, File target, String hash, long maxBytes) throws Exception {
    File temp=new File(target.getParentFile(), target.getName()+".download");
    try {
      java.net.URL url=new java.net.URL(source); HttpURLConnection connection=null;
      for (int redirect=0; redirect<6; redirect++) {
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IOException("안전하지 않은 다운로드 경로입니다.");
        connection=(HttpURLConnection)url.openConnection(); connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(20000); connection.setReadTimeout(30000);
        int code=connection.getResponseCode();
        if (code>=300 && code<400) { String location=connection.getHeaderField("Location"); connection.disconnect(); if(location==null) throw new IOException("다운로드 경로가 없습니다."); url=new java.net.URL(url,location); connection=null; continue; }
        if (code!=200) { connection.disconnect(); throw new IOException("모델 다운로드에 실패했습니다 ("+code+")."); }
        break;
      }
      if(connection==null) throw new IOException("다운로드 경로가 너무 많이 변경되었습니다.");
      try (InputStream in=connection.getInputStream(); OutputStream out=new FileOutputStream(temp)) {
        byte[] b=new byte[65536]; int n; long total=0;
        while((n=in.read(b))!=-1) { total+=n; if(total>maxBytes) throw new IOException("모델 크기 제한을 초과했습니다."); out.write(b,0,n); }
      } finally { connection.disconnect(); }
      if(!hash.equals(digest(temp))) throw new IOException("모델 무결성 검증에 실패했습니다.");
      if(!temp.renameTo(target)) throw new IOException("모델을 저장하지 못했습니다.");
    } finally { if(temp.exists()) temp.delete(); }
  }
  public static void remove(Context c) { model(c).delete(); }
  static final class Box { int cls; float score,x,y,w,h; }
  private static float iou(Box a, Box b) { float x=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)); float y=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)); float area=x*y; return area/(a.w*a.h+b.w*b.h-area+1e-9f); }
  public static List<Map<String,Object>> detect(Context c, String uri) throws Exception {
    if(!ready(c)) throw new IOException("사진 분석 모델을 먼저 다운로드해 주세요.");
    Uri imageUri=Uri.parse(uri); if(!"file".equals(imageUri.getScheme())) throw new IOException("사진 파일을 읽을 수 없습니다.");
    File image=new File(imageUri.getPath()).getCanonicalFile();
    if(!image.getPath().startsWith(c.getCacheDir().getCanonicalPath()+File.separator)) throw new IOException("앱에서 선택한 사진만 분석할 수 있습니다.");
    Bitmap original=BitmapFactory.decodeFile(image.getPath()); if(original==null) throw new IOException("사진을 읽지 못했습니다.");
    int width=original.getWidth(), height=original.getHeight();
    OrtEnvironment env=OrtEnvironment.getEnvironment(); List<Box> candidates=new ArrayList<>();
    try (OrtSession.SessionOptions options=new OrtSession.SessionOptions()) {
      options.setIntraOpNumThreads(2);
      try (OrtSession session=env.createSession(model(c).getAbsolutePath(),options)) {
        infer(env,session,original,new Rect(0,0,width,height),false,candidates);
        boolean tableFound=false;
        for(Box candidate:candidates) if(candidate.cls==60 && candidate.w*candidate.h >= .10f && candidate.y+candidate.h >= .65f) {tableFound=true; break;}
        if(!tableFound) {
          int tileWidth=Math.max(1,Math.round(width*.72f));
          int top=Math.max(0,Math.round(height*.25f));
          infer(env,session,original,new Rect(0,top,tileWidth,height),true,candidates);
          infer(env,session,original,new Rect(width-tileWidth,top,width,height),true,candidates);
        }
      }
    } finally { original.recycle(); }
    candidates.sort((a,b)->Float.compare(b.score,a.score)); List<Box> kept=new ArrayList<>();
    for(Box b:candidates) { boolean overlap=false; for(Box k:kept) if(k.cls==b.cls && iou(k,b)>.45f) {overlap=true; break;} if(!overlap) {kept.add(b); if(kept.size()==50) break;} }
    List<Map<String,Object>> output=new ArrayList<>();
    for(Box b:kept) { Map<String,Object> item=new HashMap<>(); item.put("object_type",CLASSES[b.cls]); item.put("confidence",(double)b.score); item.put("bbox",Arrays.asList((double)b.x,(double)b.y,(double)b.w,(double)b.h)); output.add(item); }
    return output;
  }
  private static void infer(OrtEnvironment env, OrtSession session, Bitmap original, Rect source, boolean tablesOnly, List<Box> candidates) throws Exception {
    int width=original.getWidth(), height=original.getHeight();
    float scale=640f/Math.max(source.width(),source.height());
    int rw=Math.round(source.width()*scale),rh=Math.round(source.height()*scale),px=(640-rw)/2,py=(640-rh)/2;
    Bitmap input=Bitmap.createBitmap(640,640,Bitmap.Config.ARGB_8888);
    Canvas canvas=new Canvas(input); canvas.drawColor(Color.rgb(114,114,114));
    canvas.drawBitmap(original,source,new Rect(px,py,px+rw,py+rh),new Paint(Paint.FILTER_BITMAP_FLAG));
    int[] pixels=new int[640*640]; input.getPixels(pixels,0,640,0,0,640,640); input.recycle();
    FloatBuffer values=ByteBuffer.allocateDirect(3*640*640*4).order(ByteOrder.nativeOrder()).asFloatBuffer();
    for(int channel=0;channel<3;channel++) for(int color:pixels) values.put(((color >> (16-channel*8)) & 255)/255f); values.rewind();
    try (OnnxTensor tensor=OnnxTensor.createTensor(env,values,new long[]{1,3,640,640}); OrtSession.Result result=session.run(Collections.singletonMap(session.getInputNames().iterator().next(),tensor))) {
      OnnxTensor output=(OnnxTensor)result.get(0);
      if(!Arrays.equals(output.getInfo().getShape(),new long[]{1,84,8400})) throw new IOException("지원하지 않는 모델 출력입니다.");
      FloatBuffer data=output.getFloatBuffer();
      for(int i=0;i<8400;i++) {
        int cls=0; float score=0; for(int j=0;j<80;j++) { float q=data.get((j+4)*8400+i); if(q>score) {score=q;cls=j;} }
        if((tablesOnly && cls!=56 && cls!=57 && cls!=59 && cls!=60) || score<(cls==60 ? .24f : .35f)) continue;
        float cx=data.get(i),cy=data.get(8400+i),w=data.get(16800+i),h=data.get(25200+i);
        float x1=Math.max(source.left,Math.min(source.right,source.left+(cx-w/2-px)/scale));
        float y1=Math.max(source.top,Math.min(source.bottom,source.top+(cy-h/2-py)/scale));
        float x2=Math.max(source.left,Math.min(source.right,source.left+(cx+w/2-px)/scale));
        float y2=Math.max(source.top,Math.min(source.bottom,source.top+(cy+h/2-py)/scale));
        if(x2-x1<2 || y2-y1<2) continue;
        Box box=new Box();box.cls=cls;box.score=score;box.x=x1/width;box.y=y1/height;box.w=(x2-x1)/width;box.h=(y2-y1)/height;candidates.add(box);
      }
    }
  }

}
