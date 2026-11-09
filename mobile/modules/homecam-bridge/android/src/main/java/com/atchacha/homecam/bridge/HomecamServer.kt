package com.atchacha.homecam.bridge

import org.json.JSONObject
import java.io.Closeable
import java.io.InputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Collections
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Small, bounded signaling listener. Video never passes through this HTTP service.
 * Production binds ONLY the Tailscale interface. No CORS, cookies, files or logs.
 */
internal class HomecamServer(
  private val address: InetAddress,
  private val viewerToken: String,
  private val cameraId: String,
  private val clock: () -> Long = { System.nanoTime() / 1_000_000 },
  private val testLoopback: Boolean = false,
) : Closeable {
  companion object {
    fun secret(): String = ByteArray(32).also { SecureRandom().nextBytes(it) }
      .joinToString("") { "%02x".format(it.toInt() and 255) }
    fun isTailnet(ip: String): Boolean {
      val parts = ip.split('.').map { it.toIntOrNull() ?: return false }
      return parts.size == 4 && parts.all { it in 0..255 } && parts[0] == 100 && parts[1] in 64..127
    }
    private fun equal(a: String, b: String) = MessageDigest.isEqual(a.toByteArray(), b.toByteArray())
  }
  private class Failure(val status: Int, override val message: String) : Exception(message)
  private val listener = ServerSocket()
  private val clients = Collections.synchronizedSet(mutableSetOf<Socket>())
  private val workers = ThreadPoolExecutor(2, 4, 20, TimeUnit.SECONDS, ArrayBlockingQueue<Runnable>(8))
  @Volatile private var closed = false
  private var streaming = false
  private var pairSecret = ""
  private var pairUntil = 0L
  private var failures = 0
  private var rateUntil = 0L
  private var offerId = ""
  private var offerSdp = ""
  private var answerSdp = ""
  private var leaseUntil = 0L
  val port get() = listener.localPort

  fun start() {
    require(isTailnet(address.hostAddress ?: "") || (testLoopback && address.isLoopbackAddress))
    require(viewerToken.matches(Regex("[a-f0-9]{64}")) && cameraId.matches(Regex("[a-f0-9]{64}")))
    listener.reuseAddress = true
    listener.bind(InetSocketAddress(address, if (testLoopback) 0 else 8787), 8)
    Thread({
      while (!closed) {
        try {
          val client = listener.accept()
          if (!isTailnet(client.inetAddress.hostAddress ?: "") && !(testLoopback && client.inetAddress.isLoopbackAddress)) {
            client.close(); continue
          }
          clients.add(client)
          try { workers.execute { handle(client) } }
          catch (_: Exception) { clients.remove(client); client.close() }
        } catch (_: Exception) { if (!closed) close() }
      }
    }, "atchacha-signal").apply { isDaemon = true; start() }
  }

  @Synchronized fun newPairing(): Map<String, Any> {
    pairSecret = secret(); pairUntil = clock() + 120_000
    return mapOf("pair" to pairSecret, "expiresIn" to 120)
  }
  @Synchronized fun setStreaming(enabled: Boolean) {
    streaming = enabled
    if (!enabled) clearOffer()
  }
  @Synchronized private fun clearOffer() {
    offerId = ""; offerSdp = ""; answerSdp = ""; leaseUntil = 0
  }
  @Synchronized fun takeOffer(): Map<String, String>? {
    if (clock() > leaseUntil) clearOffer()
    return if (streaming && offerId.isNotEmpty()) mapOf("id" to offerId, "sdp" to offerSdp) else null
  }
  @Synchronized fun setAnswer(id: String, sdp: String) {
    if (streaming && offerId == id && clock() <= leaseUntil) {
      validateSdp(sdp); answerSdp = sdp
    }
  }
  private fun validateSdp(sdp: String) {
    if (sdp.length > 48_000 || !sdp.startsWith("v=0") || !sdp.contains("m=video") || !sdp.contains("a=fingerprint:"))
      throw Failure(400, "영상 연결 정보를 확인하세요.")
  }

  @Synchronized private fun dispatch(method: String, path: String, body: String): JSONObject {
    val data = if (body.isEmpty()) JSONObject() else try { JSONObject(body) }
      catch (_: Exception) { throw Failure(400, "잘못된 요청입니다.") }
    if (method == "POST" && path == "/v1/pair") {
      if (clock() >= rateUntil) { failures = 0; rateUntil = clock() + 60_000 }
      if (failures >= 10) throw Failure(429, "잠시 후 다시 등록하세요.")
      if (pairSecret.isEmpty() || clock() >= pairUntil || !equal(data.optString("pair"), pairSecret)) {
        failures++; throw Failure(401, "QR이 만료되었거나 이미 사용되었습니다. 새 QR을 만드세요.")
      }
      pairSecret = ""; pairUntil = 0
      return JSONObject().put("id", cameraId).put("token", viewerToken)
    }
    if (method == "GET" && path == "/v1/status") return JSONObject().put("ready", streaming).put("id", cameraId)
    if (method == "POST" && path == "/v1/offer") {
      if (!streaming) throw Failure(409, "공기계에서 촬영 시작을 눌러 주세요.")
      val sdp = data.optString("sdp"); validateSdp(sdp)
      offerId = secret(); offerSdp = sdp; answerSdp = ""; leaseUntil = clock() + 45_000
      return JSONObject().put("id", offerId)
    }
    if (path.startsWith("/v1/answer/") && method == "GET") {
      val id = path.removePrefix("/v1/answer/")
      if (!streaming || id != offerId || clock() > leaseUntil) throw Failure(410, "영상 연결이 종료되었습니다.")
      leaseUntil = clock() + 30_000
      return JSONObject().put("sdp", answerSdp)
    }
    if (path.startsWith("/v1/offer/") && method == "DELETE") {
      if (path.removePrefix("/v1/offer/") == offerId) clearOffer()
      return JSONObject().put("ok", true)
    }
    throw Failure(404, "요청을 찾을 수 없습니다.")
  }

  private fun line(input: InputStream, max: Int): String {
    val bytes = ArrayList<Byte>()
    while (bytes.size <= max) {
      val next = input.read()
      if (next < 0) throw Failure(400, "요청이 끊어졌습니다.")
      if (next == 10) {
        if (bytes.lastOrNull()?.toInt() != 13) throw Failure(400, "잘못된 요청입니다.")
        return bytes.dropLast(1).toByteArray().toString(Charsets.US_ASCII)
      }
      bytes.add(next.toByte())
    }
    throw Failure(413, "요청이 너무 큽니다.")
  }
  private fun handle(client: Socket) {
    client.use {
      try {
        client.soTimeout = 4000
        val input = client.getInputStream().buffered()
        val request = line(input, 256).split(' ')
        if (request.size != 3 || request[2] != "HTTP/1.1") throw Failure(400, "잘못된 요청입니다.")
        val headers = mutableMapOf<String, String>()
        var size = 0
        while (true) {
          val header = line(input, 2048)
          if (header.isEmpty()) break
          size += header.length
          if (size > 8192) throw Failure(413, "요청이 너무 큽니다.")
          val parts = header.split(':', limit = 2)
          if (parts.size != 2 || headers.put(parts[0].lowercase(), parts[1].trim()) != null) throw Failure(400, "잘못된 요청입니다.")
        }
        if (headers.containsKey("origin") || headers.containsKey("transfer-encoding")) throw Failure(403, "앱에서 연결하세요.")
        if (headers["host"] != "${address.hostAddress}:$port") throw Failure(403, "주소를 확인하세요.")
        val pairing = request[0] == "POST" && request[1] == "/v1/pair"
        if (!pairing && !equal(headers["authorization"] ?: "", "Bearer $viewerToken")) throw Failure(401, "기기를 다시 등록하세요.")
        val length = headers["content-length"]?.toIntOrNull() ?: if (request[0] == "POST") -1 else 0
        if (length < 0 || length > (if (pairing) 512 else 60_000)) throw Failure(413, "요청이 너무 큽니다.")
        if (request[0] == "POST" && headers["content-type"]?.substringBefore(';') != "application/json") throw Failure(415, "JSON 요청만 허용됩니다.")
        val body = ByteArray(length)
        var offset = 0
        while (offset < length) {
          val read = input.read(body, offset, length - offset)
          if (read <= 0) throw Failure(400, "요청이 끊어졌습니다.")
          offset += read
        }
        respond(client, 200, dispatch(request[0], request[1], body.toString(Charsets.UTF_8)))
      } catch (failure: Failure) {
        runCatching { respond(client, failure.status, JSONObject().put("error", failure.message)) }
      } catch (_: Exception) {
        runCatching { respond(client, 400, JSONObject().put("error", "연결 요청을 처리하지 못했습니다.")) }
      } finally { clients.remove(client) }
    }
  }
  private fun respond(client: Socket, status: Int, data: JSONObject) {
    val bytes = data.toString().toByteArray(Charsets.UTF_8)
    val head = "HTTP/1.1 $status Result\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
    client.getOutputStream().apply { write(head.toByteArray()); write(bytes); flush() }
  }
  override fun close() {
    closed = true
    runCatching { listener.close() }
    synchronized(clients) { clients.toList().forEach { runCatching { it.close() } }; clients.clear() }
    workers.shutdownNow()
    synchronized(this) { streaming = false; pairSecret = ""; clearOffer() }
  }
}
