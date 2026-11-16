package com.oney.WebRTCModule;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;

/** Export an explicit manual recording to the user's media library. */
public final class GalleryExport {
  private GalleryExport() {}
  public static void export(Context context, File source) throws IOException {
    if (Build.VERSION.SDK_INT < 29) throw new IOException("Android 10 이상에서 갤러리 저장을 지원합니다.");
    if (!source.isFile() || !source.getName().matches("manual_[0-9]+\\.mp4")) throw new IOException("녹화 영상을 찾지 못했습니다.");
    ContentValues values = new ContentValues();
    values.put(MediaStore.Video.Media.DISPLAY_NAME, "Atchacha_" + source.getName());
    values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
    values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Atchacha");
    values.put(MediaStore.Video.Media.IS_PENDING, 1);
    Uri uri = context.getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
    if (uri == null) throw new IOException("갤러리 저장 공간을 만들지 못했습니다.");
    try {
      try (FileInputStream in = new FileInputStream(source); OutputStream out = context.getContentResolver().openOutputStream(uri, "w")) {
        if (out == null) throw new IOException("갤러리 파일을 열지 못했습니다.");
        byte[] buffer = new byte[32768];
        int n; while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
      }
      ContentValues ready = new ContentValues(); ready.put(MediaStore.Video.Media.IS_PENDING, 0);
      if (context.getContentResolver().update(uri, ready, null, null) != 1) throw new IOException("갤러리 저장을 완료하지 못했습니다.");
    } catch (Exception error) {
      context.getContentResolver().delete(uri, null, null);
      throw new IOException("갤러리 저장 실패", error);
    }
  }
}
