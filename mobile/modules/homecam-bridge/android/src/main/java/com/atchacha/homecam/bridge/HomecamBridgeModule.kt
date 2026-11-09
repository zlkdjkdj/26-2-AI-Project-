package com.atchacha.homecam.bridge

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.Inet4Address
import java.net.NetworkInterface
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build

class HomecamBridgeModule : Module() {
  private var server: HomecamServer? = null

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
    AsyncFunction("stop") { server?.close(); server = null }
    OnDestroy { server?.close(); server = null }
  }
}
