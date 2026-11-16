package com.oney.WebRTCModule;

import android.content.Context;
import android.graphics.*;
import android.media.*;
import android.os.SystemClock;
import com.facebook.react.bridge.ReactContext;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.pose.*;
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions;
import java.io.*;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.webrtc.*;

/** Experimental local-only fall-candidate recorder. All times use monotonic clock. */
public final class FallEventRecorder implements VideoSink, AutoCloseable {
  private static final int INTERVAL_MS=200, PRE_MS=8000, POST_MS=8000, MAX_FRAMES=84, MAX_CLIPS=20;
  private final ReactContext context;
  private final boolean automatic;
  private final PoseDetector pose=PoseDetection.getClient(new PoseDetectorOptions.Builder().setDetectorMode(PoseDetectorOptions.STREAM_MODE).build());
  private final ExecutorService worker=Executors.newSingleThreadExecutor();
  private final ExecutorService encoder=Executors.newSingleThreadExecutor();
  private final ScheduledExecutorService timer=Executors.newSingleThreadScheduledExecutor();
  private final AtomicBoolean busy=new AtomicBoolean();
  private final ArrayDeque<Frame> ring=new ArrayDeque<>();
  private final Object lock=new Object();
  private volatile boolean closed=false, encoding=false, manualActive=false;
  private volatile String status="감지 준비 중";
  private static volatile String lastManualStatus="";
  private VideoTrack track;
  private long lastFrame=0, eventAt=0;
  private int lastRotation=0;
  private final FallHeuristic heuristic=new FallHeuristic();
  private ArrayList<Frame> eventFrames;
  private static class Frame { final long time; final byte[] jpeg; Frame(long t, byte[] b){time=t;jpeg=b;} }

  public FallEventRecorder(Context ctx){ this(ctx,true); }
  public FallEventRecorder(Context ctx,boolean automatic){ if(!(ctx instanceof ReactContext)) throw new IllegalStateException("앱 화면을 준비하지 못했습니다."); context=(ReactContext)ctx; this.automatic=automatic; }
  public void start(String streamId) throws Exception {
    boolean attached=ThreadUtils.submitToExecutor(() -> {
      if(closed)return false;
      WebRTCModule module=context.getNativeModule(WebRTCModule.class);
      MediaStream stream=module==null?null:module.getStreamForReactTag(streamId);
      if(stream==null||stream.videoTracks.isEmpty())return false;
      track=stream.videoTracks.get(0); track.addSink(this); return true;
    }).get(3,TimeUnit.SECONDS);
    if(!attached)throw new IllegalStateException("촬영 영상 트랙을 찾지 못했습니다.");
    status=automatic?"낙상 의심 감지 중":"녹화 준비 완료";
  }
  @Override public void onFrame(VideoFrame frame){
    long now=SystemClock.elapsedRealtime();
    if(closed||(!automatic&&!manualActive)||now-lastFrame<INTERVAL_MS||!busy.compareAndSet(false,true))return;
    lastFrame=now; frame.retain();
    try {worker.execute(() -> process(frame,now));} catch(RejectedExecutionException e){ frame.release(); busy.set(false); }
  }
  private void process(VideoFrame frame,long now){
    VideoFrame.I420Buffer data=null;
    try {
      if(closed)return;
      data=frame.getBuffer().toI420(); int width=data.getWidth(),height=data.getHeight(),rot=frame.getRotation(); lastRotation=rot;
      byte[] nv=nv21(data);
      ByteArrayOutputStream output=new ByteArrayOutputStream();
      new YuvImage(nv,ImageFormat.NV21,width,height,null).compressToJpeg(new Rect(0,0,width,height),45,output);
      byte[] jpeg=output.toByteArray();
      synchronized(lock){
        if(automatic){ring.addLast(new Frame(now,jpeg));
        while(ring.size()>MAX_FRAMES||(!ring.isEmpty()&&now-ring.peekFirst().time>PRE_MS))ring.removeFirst();}
        if(eventFrames!=null){
          eventFrames.add(new Frame(now,jpeg));
          if(now-eventAt>=(automatic?POST_MS:60000)){
            ArrayList<Frame> completed=eventFrames; eventFrames=null;
            manualActive=false;
            if(!encoding){ encoding=true; status="영상 저장 중"; encoder.execute(() -> save(completed,rot)); }
          }
        }
      }
      if(!automatic){busy.set(false);return;}
      InputImage image=InputImage.fromByteArray(nv,width,height,rot,InputImage.IMAGE_FORMAT_NV21);
      final int outW=rot==90||rot==270?height:width, outH=rot==90||rot==270?width:height;
      pose.process(image).addOnSuccessListener(p -> observe(p,outW,outH,now)).addOnFailureListener(e -> status="자세 감지 오류 · 촬영을 다시 시작하세요").addOnCompleteListener(t -> busy.set(false));
      return;
    } catch(Throwable e){status="감지 오류 · 촬영을 다시 시작하세요"; busy.set(false);}
    finally {if(data!=null)data.release();frame.release();}
    busy.set(false);
  }
  private void observe(Pose pose,int w,int h,long now){
    if(closed)return;
    PoseLandmark ls=pose.getPoseLandmark(PoseLandmark.LEFT_SHOULDER),rs=pose.getPoseLandmark(PoseLandmark.RIGHT_SHOULDER),lh=pose.getPoseLandmark(PoseLandmark.LEFT_HIP),rh=pose.getPoseLandmark(PoseLandmark.RIGHT_HIP);
    if(ls==null||rs==null||lh==null||rh==null||ls.getInFrameLikelihood()<.6f||rs.getInFrameLikelihood()<.6f||lh.getInFrameLikelihood()<.6f||rh.getInFrameLikelihood()<.6f)return;
    float sx=(ls.getPosition().x+rs.getPosition().x)/2, sy=(ls.getPosition().y+rs.getPosition().y)/2;
    float hx=(lh.getPosition().x+rh.getPosition().x)/2, hy=(lh.getPosition().y+rh.getPosition().y)/2;
    float dx=Math.abs(hx-sx)/w,dy=Math.abs(hy-sy)/h,center=(hy+sy)/(2*h);
    if(heuristic.observe(dx,dy,center,now)){
      synchronized(lock){
        if(eventFrames==null&&!encoding){
          eventAt=now; eventFrames=new ArrayList<>(ring); status="낙상 의심 · 영상 기록 중";
        }
      }
    }
  }
  private static byte[] nv21(VideoFrame.I420Buffer b){
    int w=b.getWidth(),h=b.getHeight(),cw=(w+1)/2,ch=(h+1)/2,i=0;
    byte[] out=new byte[w*h+cw*ch*2]; ByteBuffer y=b.getDataY(),u=b.getDataU(),v=b.getDataV(); int y0=y.position(),u0=u.position(),v0=v.position();
    for(int r=0;r<h;r++)for(int c=0;c<w;c++)out[i++]=y.get(y0+r*b.getStrideY()+c);
    for(int r=0;r<ch;r++)for(int c=0;c<cw;c++){out[i++]=v.get(v0+r*b.getStrideV()+c);out[i++]=u.get(u0+r*b.getStrideU()+c);} return out;
  }
  public String status(){return status;}
  public void startManual(){synchronized(lock){if(automatic||closed||eventFrames!=null||encoding)throw new IllegalStateException("이미 녹화 중이거나 저장 중입니다.");eventFrames=new ArrayList<>();eventAt=SystemClock.elapsedRealtime();manualActive=true;status="녹화 중 · 최대 60초";lastManualStatus="";timer.schedule(this::finishManual,60,TimeUnit.SECONDS);}}
  public void finishManual(){synchronized(lock){if(!manualActive)return;manualActive=false;ArrayList<Frame> completed=eventFrames;eventFrames=null;encoding=true;status="영상 저장 중";lastManualStatus=status;int rotation=lastRotation;encoder.execute(()->save(completed,rotation));}}
  public static String lastManualStatus(){return lastManualStatus;}
  public static File folder(Context c){File dir=new File(c.getFilesDir(),"fall-events");if(!dir.exists())dir.mkdirs();return dir;}
  private void save(List<Frame> frames,int rotation){
    File tmp=null;
    try {
      File dir=folder(context);File[] files=dir.listFiles((d,n)->n.endsWith(".mp4"));
      if(files!=null&&files.length>=MAX_CLIPS)throw new IOException("저장 공간 한도: 기존 영상을 삭제하세요");
      if(dir.getUsableSpace()<100L*1024*1024)throw new IOException("저장 공간이 부족합니다");
      if(frames.size()<5)throw new IOException("영상 프레임이 부족합니다");
      tmp=new File(dir,(automatic?"event_":"manual_")+System.currentTimeMillis()+".tmp");
      encode(frames,rotation,tmp);
      File dest=new File(dir,tmp.getName().replace(".tmp",".mp4"));
      if(!tmp.renameTo(dest))throw new IOException("영상 저장을 완료하지 못했습니다");
      if (automatic) status="낙상 의심 영상 저장됨 · 직접 확인하세요";
      else {
        try { GalleryExport.export(context,dest); status="녹화 영상 저장됨 · 갤러리의 Atchacha 앨범"; }
        catch (Exception error) { status="앱에 저장됨 · 갤러리 저장 실패, 목록에서 다시 시도하세요"; }
      }
    }catch(Throwable e){if(tmp!=null)tmp.delete();status="영상 저장 실패 · "+e.getMessage();}
    finally{if(!automatic)lastManualStatus=status;encoding=false;}
  }
  private static void encode(List<Frame> frames,int rotation,File out) throws Exception {
    BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
    BitmapFactory.decodeByteArray(frames.get(0).jpeg,0,frames.get(0).jpeg.length,bounds);
    int srcW=rotation==90||rotation==270?bounds.outHeight:bounds.outWidth;
    int srcH=rotation==90||rotation==270?bounds.outWidth:bounds.outHeight;
    if(srcW<=0||srcH<=0)throw new IOException("영상 크기를 확인하지 못했습니다");
    final int w=srcW>=srcH?320:Math.max(2,((int)(320.0*srcW/srcH))&~1);
    final int h=srcH>srcW?320:Math.max(2,((int)(320.0*srcH/srcW))&~1);
    MediaCodecInfo selected=null; int color=0;
    for(MediaCodecInfo info:new MediaCodecList(MediaCodecList.REGULAR_CODECS).getCodecInfos()){
      if(!info.isEncoder())continue;
      for(String type:info.getSupportedTypes())if(type.equalsIgnoreCase("video/avc")){
        for(int c:info.getCapabilitiesForType(type).colorFormats)if(c==MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Planar||c==MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar){selected=info;color=c;break;}
        if(selected!=null)break;
      } if(selected!=null)break;
    }
    if(selected==null)throw new IOException("이 기기에서 영상 인코딩을 지원하지 않습니다");
    MediaCodec codec=MediaCodec.createByCodecName(selected.getName()); MediaMuxer mux=null; boolean muxStarted=false,success=false;
    try{
      MediaFormat format=MediaFormat.createVideoFormat("video/avc",w,h);
      format.setInteger(MediaFormat.KEY_COLOR_FORMAT,color);format.setInteger(MediaFormat.KEY_BIT_RATE,500000);format.setInteger(MediaFormat.KEY_FRAME_RATE,5);format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL,1);
      codec.configure(format,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE);codec.start();mux=new MediaMuxer(out.getAbsolutePath(),MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
      int index=0,trackIndex=-1;boolean eos=false;long first=frames.get(0).time; MediaCodec.BufferInfo info=new MediaCodec.BufferInfo();
      long deadline=SystemClock.elapsedRealtime()+60000;
      while(!eos){
        if(SystemClock.elapsedRealtime()>deadline)throw new IOException("영상 변환 시간 초과");
        if(index<=frames.size()){
          int in=codec.dequeueInputBuffer(10000);
          if(in>=0){
            ByteBuffer buffer=codec.getInputBuffer(in);if(buffer==null)throw new IOException("인코더 입력 오류");buffer.clear();
            if(index==frames.size()){codec.queueInputBuffer(in,0,0,(frames.get(frames.size()-1).time-first+200)*1000,MediaCodec.BUFFER_FLAG_END_OF_STREAM);index++;}
            else{Frame frame=frames.get(index++);Bitmap bmp=BitmapFactory.decodeByteArray(frame.jpeg,0,frame.jpeg.length);if(bmp==null)throw new IOException("영상 프레임 오류");
              Matrix m=new Matrix();m.postRotate(rotation);Bitmap rotated=Bitmap.createBitmap(bmp,0,0,bmp.getWidth(),bmp.getHeight(),m,true);Bitmap scaled=Bitmap.createScaledBitmap(rotated,w,h,true);
              byte[] yuv=toYuv(scaled,color==MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar);buffer.put(yuv);codec.queueInputBuffer(in,0,yuv.length,(frame.time-first)*1000,0);
              if(scaled!=rotated)scaled.recycle();if(rotated!=bmp)rotated.recycle();bmp.recycle();
            }
          }
        }
        int output=codec.dequeueOutputBuffer(info,10000);
        if(output==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){if(muxStarted)throw new IOException("인코더 형식 변경 오류");trackIndex=mux.addTrack(codec.getOutputFormat());mux.start();muxStarted=true;}
        else if(output>=0){ByteBuffer data=codec.getOutputBuffer(output);if((info.flags&MediaCodec.BUFFER_FLAG_CODEC_CONFIG)!=0)info.size=0;if(info.size>0){if(!muxStarted||data==null)throw new IOException("영상 쓰기 오류");data.position(info.offset);data.limit(info.offset+info.size);mux.writeSampleData(trackIndex,data,info);}eos=(info.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;codec.releaseOutputBuffer(output,false);}
      }
      success=muxStarted;
    }finally{try{codec.stop();}catch(Exception ignored){}codec.release();if(mux!=null){if(muxStarted)try{mux.stop();}catch(Exception ignored){}mux.release();}}
    if(!success)throw new IOException("영상 생성 실패");
  }
  private static byte[] toYuv(Bitmap bitmap,boolean semi){
    int w=bitmap.getWidth(),h=bitmap.getHeight(),size=w*h;int[] pixels=new int[size];bitmap.getPixels(pixels,0,w,0,0,w,h);byte[] out=new byte[size*3/2];int ui=size,vi=size+size/4;
    for(int y=0;y<h;y++)for(int x=0;x<w;x++){int p=pixels[y*w+x],r=Color.red(p),g=Color.green(p),b=Color.blue(p);out[y*w+x]=(byte)clamp(((66*r+129*g+25*b+128)>>8)+16);
      if((y&1)==0&&(x&1)==0){int u=clamp(((-38*r-74*g+112*b+128)>>8)+128),v=clamp(((112*r-94*g-18*b+128)>>8)+128);if(semi){out[ui++]=(byte)u;out[ui++]=(byte)v;}else{out[ui++]=(byte)u;out[vi++]=(byte)v;}}
    }return out;
  }
  private static int clamp(int x){return Math.max(0,Math.min(255,x));}
  @Override public void close(){closed=true; synchronized(lock){ring.clear();manualActive=false;if(eventFrames!=null&&!encoding){ArrayList<Frame> partial=eventFrames;eventFrames=null;encoding=true;if(!automatic)lastManualStatus="영상 저장 중";int rotation=lastRotation;encoder.execute(()->save(partial,rotation));}} timer.shutdownNow();worker.shutdown();encoder.shutdown();ThreadUtils.runOnExecutor(()->{if(track!=null){track.removeSink(this);track=null;}});pose.close();}
}
