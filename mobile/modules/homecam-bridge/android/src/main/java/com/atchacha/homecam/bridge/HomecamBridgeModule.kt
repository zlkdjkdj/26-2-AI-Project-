package com.atchacha.homecam.bridge

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.Inet4Address
import java.net.NetworkInterface
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import com.oney.WebRTCModule.PersonVideoDetector
import com.oney.WebRTCModule.FallEventRecorder
import com.oney.WebRTCModule.GalleryExport
import android.content.Intent
import androidx.core.content.FileProvider
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.util.Rational
import expo.modules.kotlin.functions.Queues
import android.app.Activity
import java.lang.ref.WeakReference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

class HomecamBridgeModule : Module() {
  private var server: HomecamServer? = null
  private var personDetector: PersonVideoDetector? = null
  private var fallRecorder: FallEventRecorder? = null
  private var manualRecorder: FallEventRecorder? = null
  private var pipActivity: WeakReference<Activity>? = null
  private val photoScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

  override fun definition() = ModuleDefinition {
    Name("HomecamBridge")
    Function("createSecret") { HomecamServer.secret() }
    AsyncFunction("networkStatus") {
      val hasTailnet = NetworkInterface.getNetworkInterfaces().toList()
        .filter { it.isUp }.flatMap { it.inetAddresses.toList() }
        .filterIsInstance<Inet4Address>().any { HomecamServer.isTailnet(it.hostAddress ?: "") }
      val manager = appContext.reactContext?.getSystemService(ConnectivityManager::class.java)
      val hasVpn = manager?.allNetworks?.any {
        manager.getNetworkCapabilities(it)?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
      } ?: false
      mapOf("tailnetInterface" to hasTailnet, "vpnNetwork" to hasVpn, "androidVersion" to Build.VERSION.SDK_INT)
    }
    AsyncFunction("start") { token: String, id: String ->
      server?.close()
      val addresses = NetworkInterface.getNetworkInterfaces().toList()
        .filter { it.isUp }.flatMap { it.inetAddresses.toList() }
        .filterIsInstance<Inet4Address>().filter { HomecamServer.isTailnet(it.hostAddress ?: "") }
      val address = addresses.firstOrNull()
        ?: throw IllegalStateException("Tailscale을 켜고 연결한 뒤 다시 시도하세요.")
      val next = HomecamServer(address, token, id)
      next.start()
      server = next
      mapOf("origin" to "http://${address.hostAddress}:${next.port}")
    }
    Function("newPairing") {
      server?.newPairing() ?: throw IllegalStateException("촬영 기기를 먼저 준비하세요.")
    }
    Function("setStreaming") { enabled: Boolean -> server?.setStreaming(enabled) }
    Function("takeOffer") { server?.takeOffer() }
    Function("setAnswer") { id: String, sdp: String -> server?.setAnswer(id, sdp) }
    AsyncFunction("offlineModelReady") { OfflinePhotoDetector.ready(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")) }
    AsyncFunction("downloadOfflineModel") { OfflinePhotoDetector.download(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")); true }
    AsyncFunction("removeOfflineModel") { OfflinePhotoDetector.remove(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")); true }
    AsyncFunction("detectOfflinePhoto") { uri: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")
      val general = OfflinePhotoDetector.detect(context, uri)
      // 콘센트·멀티탭은 직접 학습한 전용 모델로 찾는다. 이 모델이 실패해도 기본 결과는 그대로 돌려준다.
      val outlets = try { OfflineOutletDetector.detect(context, uri) } catch (error: Throwable) { android.util.Log.w("Atchacha", "outlet detector failed", error); emptyList() }
      general + outlets
    }.runOnQueue(photoScope)
    AsyncFunction("electricalModelSupported") { OfflineElectricalDetector.supported(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")) }
    AsyncFunction("electricalModelReady") { OfflineElectricalDetector.ready(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")) }
    AsyncFunction("downloadElectricalModel") { OfflineElectricalDetector.download(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")); true }
    AsyncFunction("removeElectricalModel") { OfflineElectricalDetector.remove(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")); true }
    AsyncFunction("photoParallelSupported") { OfflineElectricalDetector.parallelSupported(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다.")) }
    AsyncFunction("detectElectricalPhoto") { uri: String, parallel: Boolean -> OfflineElectricalDetector.detect(appContext.reactContext ?: throw IllegalStateException("앱을 준비하지 못했습니다."), uri, parallel) }.runOnQueue(photoScope)
    AsyncFunction("startPersonDetection") { streamId: String ->
      personDetector?.close()
      val context = appContext.reactContext ?: throw IllegalStateException("화면을 준비하지 못했습니다.")
      val next = PersonVideoDetector(context)
      try { next.start(streamId); personDetector = next } catch (error: Exception) { next.close(); throw error }
    }
    Function("personDetectionResult") { personDetector?.result() }
    AsyncFunction("stopPersonDetection") { personDetector?.close(); personDetector = null }
    AsyncFunction("startFallRecorder") { streamId: String ->
      fallRecorder?.close()
      val context = appContext.reactContext ?: throw IllegalStateException("화면을 준비하지 못했습니다.")
      val next = FallEventRecorder(context)
      try { next.start(streamId); fallRecorder = next } catch (error: Exception) { next.close(); throw error }
    }
    Function("fallRecorderStatus") { fallRecorder?.status() ?: "감지 중지됨" }
    Function("isPictureInPicture") { Build.VERSION.SDK_INT >= 26 && (appContext.currentActivity ?: pipActivity?.get())?.isInPictureInPictureMode == true }
    AsyncFunction("enterPictureInPicture") {
      val activity = appContext.currentActivity ?: throw IllegalStateException("화면을 준비하지 못했습니다.")
      pipActivity = WeakReference(activity)
      if (Build.VERSION.SDK_INT < 26 || !activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE))
        throw IllegalStateException("이 기기에서는 PIP를 지원하지 않습니다.")
      if (!activity.enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9)).build()))
        throw IllegalStateException("PIP를 시작하지 못했습니다. 기기의 PIP 권한을 확인하세요.")
      true
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stopFallRecorder") { fallRecorder?.close(); fallRecorder = null }
    AsyncFunction("startManualRecorder") { streamId: String ->
      manualRecorder?.close()
      val context = appContext.reactContext ?: throw IllegalStateException("화면을 준비하지 못했습니다.")
      val next = FallEventRecorder(context, false)
      try { next.start(streamId); next.startManual(); manualRecorder = next } catch (error: Exception) { next.close(); throw error }
    }
    Function("manualRecorderStatus") { manualRecorder?.status() ?: "녹화 중지됨" }
    Function("lastManualSaveStatus") { FallEventRecorder.lastManualStatus() }
    Function("finishManualRecording") { manualRecorder?.finishManual() }
    AsyncFunction("stopManualRecorder") { manualRecorder?.close(); manualRecorder = null }
    AsyncFunction("listFallEvents") {
      val context = appContext.reactContext ?: throw IllegalStateException("화면을 준비하지 못했습니다.")
      val records: List<Map<String, Any>> = FallEventRecorder.folder(context).listFiles()?.filter { it.name.matches(Regex("(event|manual)_[0-9]+\\.mp4")) }
        ?.sortedByDescending { it.lastModified() }
        ?.map { mapOf<String, Any>("name" to it.name, "createdAt" to it.lastModified(), "size" to it.length()) } ?: emptyList()
      records
    }
    AsyncFunction("openFallEvent") { name: String ->
      require(name.matches(Regex("(event|manual)_[0-9]+\\.mp4"))) { "잘못된 영상 이름입니다." }
      val context = appContext.reactContext ?: throw IllegalStateException("화면을 준비하지 못했습니다.")
      val file = java.io.File(FallEventRecorder.folder(context), name)
      require(file.isFile) { "영상을 찾지 못했습니다." }
      val uri = FileProvider.getUriForFile(context, context.packageName + ".fallfiles", file)
      val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "video/mp4")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
    AsyncFunction("exportRecording") { name: String ->
      require(name.matches(Regex("manual_[0-9]+\\.mp4"))) { "잘못된 영상 이름입니다." }
      val context = appContext.reactContext ?: throw IllegalStateException("화면을 준비하지 못했습니다.")
      GalleryExport.export(context, java.io.File(FallEventRecorder.folder(context), name))
      true
    }
    AsyncFunction("deleteFallEvent") { name: String ->
      require(name.matches(Regex("(event|manual)_[0-9]+\\.mp4"))) { "잘못된 영상 이름입니다." }
      val context = appContext.reactContext ?: throw IllegalStateException("화면을 준비하지 못했습니다.")
      val file = java.io.File(FallEventRecorder.folder(context), name)
      if (file.exists() && !file.delete()) throw IllegalStateException("영상을 삭제하지 못했습니다.")
    }
    AsyncFunction("stop") { server?.close(); server = null }
    OnDestroy { photoScope.cancel(); manualRecorder?.close(); manualRecorder = null; fallRecorder?.close(); fallRecorder = null; personDetector?.close(); personDetector = null; server?.close(); server = null }
  }
}
