package com.atchacha.homecam.bridge

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.Inet4Address
import java.net.NetworkInterface

class HomecamBridgeModule : Module() {
  private var server: HomecamServer? = null

  override fun definition() = ModuleDefinition {
    Name("HomecamBridge")
    Function("createSecret") { HomecamServer.secret() }
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
