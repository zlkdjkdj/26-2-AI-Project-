package com.atchacha.homecam.bridge

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.InetAddress
import java.net.Socket

class HomecamServerTest {
  private val token = "a".repeat(64)
  private val cameraId = "b".repeat(64)
  private val sdp = "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=fingerprint:sha-256 AA\r\n"
  private fun request(server: HomecamServer, method: String, path: String, body: String = "", auth: Boolean = true, extra: String = ""): Pair<Int, JSONObject> {
    Socket("127.0.0.1", server.port).use { socket ->
      socket.soTimeout = 5000
      val headers = "$method $path HTTP/1.1\r\nHost: 127.0.0.1:${server.port}\r\n" +
        (if (auth) "Authorization: Bearer $token\r\n" else "") +
        "Content-Type: application/json\r\nContent-Length: ${body.toByteArray().size}\r\n$extra\r\n"
      socket.getOutputStream().write((headers + body).toByteArray())
      val result = socket.getInputStream().bufferedReader().readText()
      return result.substringBefore("\r\n").split(' ')[1].toInt() to JSONObject(result.substringAfter("\r\n\r\n"))
    }
  }
  private fun server(clock: () -> Long = { System.nanoTime() / 1_000_000 }) = HomecamServer(InetAddress.getLoopbackAddress(), token, cameraId, clock, true).also { it.start() }

  @Test fun pairingIsOneUseExpiringAndUnprivileged() {
    var now = 1000L
    server { now }.use { server ->
      assertEquals(401, request(server, "GET", "/v1/status", auth = false).first)
      val pair = server.newPairing()["pair"]
      val body = JSONObject().put("pair", pair).toString()
      val registered = request(server, "POST", "/v1/pair", body, false)
      assertEquals(200, registered.first); assertEquals(token, registered.second.getString("token"))
      assertEquals(401, request(server, "POST", "/v1/pair", body, false).first)
      val expired = JSONObject().put("pair", server.newPairing()["pair"]).toString()
      now += 120_001
      assertEquals(401, request(server, "POST", "/v1/pair", expired, false).first)
      assertEquals(403, request(server, "GET", "/v1/status", extra = "Origin: https://evil.example\r\n").first)
    }
  }
  @Test fun cameraMustStartAndLeaseExpiresAndStopRevokesOffer() {
    var now = 1000L
    server { now }.use { server ->
      val body = JSONObject().put("sdp", sdp).toString()
      assertEquals(409, request(server, "POST", "/v1/offer", body).first)
      server.setStreaming(true)
      val offer = request(server, "POST", "/v1/offer", body)
      assertEquals(200, offer.first)
      val id = offer.second.getString("id")
      assertEquals(id, server.takeOffer()!!["id"])
      server.setAnswer(id, sdp)
      assertEquals(sdp, request(server, "GET", "/v1/answer/$id").second.getString("sdp"))
      now += 30_001
      assertEquals(410, request(server, "GET", "/v1/answer/$id").first)
      assertNull(server.takeOffer())
      request(server, "POST", "/v1/offer", body)
      server.setStreaming(false)
      assertNull(server.takeOffer())
    }
  }
  @Test fun malformedAndOversizedRequestsAreRejectedAndPairingIsRateLimited() {
    server().use { server ->
      assertEquals(400, request(server, "POST", "/v1/offer", "not-json").first)
      assertEquals(413, request(server, "POST", "/v1/pair", "x".repeat(513), false).first)
      assertEquals(403, request(server, "POST", "/v1/pair", "{}", false, "Transfer-Encoding: chunked\r\n").first)
      repeat(10) { assertEquals(401, request(server, "POST", "/v1/pair", "{}", false).first) }
      assertEquals(429, request(server, "POST", "/v1/pair", "{}", false).first)
    }
  }
  @Test fun listenerCannotBindPublicOrLanAddresses() {
    assertTrue(HomecamServer.isTailnet("100.64.0.1"))
    assertTrue(HomecamServer.isTailnet("100.127.255.254"))
    assertFalse(HomecamServer.isTailnet("100.128.0.1"))
    assertFalse(HomecamServer.isTailnet("192.168.0.1"))
    try {
      HomecamServer(InetAddress.getLoopbackAddress(), token, cameraId).start()
      fail("production must not bind loopback")
    } catch (_: IllegalArgumentException) { }
  }
}
