package com.diu.attendance.data

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.DataOutputStream
import java.math.BigInteger
import java.net.InetAddress
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Date
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLServerSocket
import javax.security.auth.x500.X500Principal

class LocalAttendanceHttpServer(
    private val sessions: AttendanceSessionRepository,
) : Closeable {
    private val running = AtomicBoolean(false)
    private val authFailures = ConcurrentHashMap<String, FailureWindow>()
    private var socket: SSLServerSocket? = null
    private var workers: ThreadPoolExecutor? = null
    private var acceptThread: Thread? = null

    var certificateFingerprint: String = ""
        private set

    val port: Int
        get() = socket?.localPort ?: error("Server is not running")

    fun start() {
        check(running.compareAndSet(false, true)) { "Server already started" }
        try {
            socket = createTlsServerSocket()
            workers = ThreadPoolExecutor(
                WORKER_MIN,
                WORKER_MAX,
                30L,
                TimeUnit.SECONDS,
                ArrayBlockingQueue(QUEUE_CAPACITY),
                { task -> Thread(task, "rollcall-https-worker").apply { isDaemon = true } },
                ThreadPoolExecutor.CallerRunsPolicy(),
            )
            acceptThread = Thread(::acceptLoop, "rollcall-https-accept").apply {
                isDaemon = true
                start()
            }
        } catch (error: Exception) {
            stop()
            throw error
        }
    }

    override fun close() = stop()

    fun stop() {
        if (!running.getAndSet(false)) return
        runCatching { socket?.close() }
        socket = null
        workers?.shutdownNow()
        workers = null
        acceptThread = null
    }

    private fun createTlsServerSocket(): SSLServerSocket {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, ANDROID_KEYSTORE)
            val now = System.currentTimeMillis()
            generator.initialize(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setKeySize(2048)
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
                    .setCertificateSubject(X500Principal("CN=RollCall Local Attendance"))
                    .setCertificateSerialNumber(BigInteger.valueOf(now.coerceAtLeast(1L)))
                    .setCertificateNotBefore(Date(now - CERTIFICATE_CLOCK_SKEW_MILLIS))
                    .setCertificateNotAfter(Date(now + CERTIFICATE_LIFETIME_MILLIS))
                    .build(),
            )
            generator.generateKeyPair()
            keyStore.load(null)
        }

        val certificate = keyStore.getCertificate(KEY_ALIAS)
            ?: error("Could not create the local TLS certificate")
        certificateFingerprint = MessageDigest.getInstance("SHA-256")
            .digest(certificate.encoded)
            .joinToString("") { byte -> "%02X".format(byte.toInt() and 0xFF) }

        val keyManagers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply {
            init(keyStore, null)
        }
        val tls = SSLContext.getInstance("TLS").apply {
            init(keyManagers.keyManagers, null, SecureRandom())
        }
        return (tls.serverSocketFactory.createServerSocket(
            0,
            BACKLOG,
            InetAddress.getByName("0.0.0.0"),
        ) as SSLServerSocket).apply {
            enabledProtocols = supportedProtocols.filter { it == "TLSv1.2" || it == "TLSv1.3" }.toTypedArray()
        }
    }

    private fun acceptLoop() {
        while (running.get()) {
            try {
                val client = socket?.accept() ?: break
                try {
                    workers?.execute { handle(client) } ?: client.close()
                } catch (_: Exception) {
                    runCatching { client.close() }
                }
            } catch (_: Exception) {
                if (running.get()) continue else break
            }
        }
    }

    private fun handle(client: java.net.Socket) {
        client.use { connection ->
            runCatching {
                connection.soTimeout = SOCKET_TIMEOUT_MILLIS
                val input = BufferedInputStream(connection.getInputStream())
                val requestLine = readLine(input, MAX_HEADER_BYTES).toString(StandardCharsets.US_ASCII)
                val parts = requestLine.split(' ')
                if (parts.size != 3) return@runCatching respond(connection, 400, errorJson("Malformed request"))

                var totalHeaders = requestLine.length
                var contentLength = 0
                while (true) {
                    val line = readLine(input, MAX_HEADER_BYTES - totalHeaders).toString(StandardCharsets.US_ASCII)
                    totalHeaders += line.length
                    if (line.isEmpty()) break
                    if (totalHeaders > MAX_HEADER_BYTES) return@runCatching respond(connection, 431, errorJson("Headers too large"))
                    if (line.startsWith("Content-Length:", ignoreCase = true)) {
                        contentLength = line.substringAfter(':').trim().toIntOrNull() ?: -1
                    }
                }
                if (contentLength !in 0..MAX_BODY_BYTES) {
                    return@runCatching respond(connection, 413, errorJson("Request body too large"))
                }
                val body = ByteArray(contentLength)
                var offset = 0
                while (offset < body.size) {
                    val count = input.read(body, offset, body.size - offset)
                    if (count < 0) return@runCatching respond(connection, 400, errorJson("Incomplete request body"))
                    offset += count
                }

                when {
                    parts[0] == "GET" && parts[1] == "/rollcall/session" -> {
                        val current = runBlocking { sessions.activeSession() }
                        if (current == null || current.state != AttendanceSessionState.ACTIVE) {
                            respond(connection, 404, errorJson("No active session"))
                        } else {
                            val count = runBlocking { sessions.records(current.id).size }
                            respond(connection, 200, JSONObject()
                                .put("sessionId", current.id)
                                .put("courseCode", current.courseCode)
                                .put("courseName", current.courseName)
                                .put("section", current.section)
                                .put("room", current.room)
                                .put("teacherName", current.teacherName)
                                .put("expiresAtMillis", current.expiresAtMillis)
                                .put("attendanceCount", count))
                        }
                    }
                    parts[0] == "POST" && parts[1] == "/rollcall/attendance" -> {
                        val address = connection.inetAddress.hostAddress ?: "unknown"
                        if (isRateLimited(address)) {
                            respond(connection, 429, errorJson("Too many rejected requests; wait and retry"))
                        } else {
                            submit(body, address, connection)
                        }
                    }
                    else -> respond(connection, 404, errorJson("Unknown endpoint"))
                }
            }.onFailure {
                runCatching { respond(connection, 400, errorJson("Invalid request")) }
            }
        }
    }

    private fun submit(body: ByteArray, address: String, socket: java.net.Socket) {
        val json = JSONObject(String(body, StandardCharsets.UTF_8))
        val request = AttendanceRequest(
            sessionId = json.getString("sessionId"),
            studentId = json.getString("studentId"),
            studentName = json.optString("studentName"),
            credential = json.getString("sessionCode"),
        )
        when (val outcome = runBlocking { sessions.submit(request) }) {
            is AttendanceSubmission.Recorded -> {
                authFailures.remove(address)
                val record = outcome.record
                val count = runBlocking { sessions.records(record.sessionId).size }
                respond(socket, 200, JSONObject()
                    .put("recorded", true)
                    .put("sessionId", record.sessionId)
                    .put("studentId", record.studentId)
                    .put("studentName", record.studentName)
                    .put("recordedAtMillis", record.recordedAtMillis)
                    .put("attendanceCount", count))
            }
            is AttendanceSubmission.Rejected -> {
                recordFailure(address)
                respond(socket, 403, errorJson(outcome.reason))
            }
        }
    }

    private fun isRateLimited(address: String): Boolean {
        val now = System.currentTimeMillis()
        val window = authFailures[address] ?: return false
        if (now - window.startedAtMillis >= FAILURE_WINDOW_MILLIS) {
            authFailures.remove(address, window)
            return false
        }
        return window.count >= MAX_FAILURES_PER_WINDOW
    }

    private fun recordFailure(address: String) {
        val now = System.currentTimeMillis()
        authFailures.compute(address) { _, previous ->
            if (previous == null || now - previous.startedAtMillis >= FAILURE_WINDOW_MILLIS) {
                FailureWindow(now, 1)
            } else previous.copy(count = previous.count + 1)
        }
    }

    private fun readLine(input: BufferedInputStream, remainingLimit: Int): ByteArray {
        require(remainingLimit > 0) { "Header too large" }
        val output = ByteArrayOutputStream()
        var previous = -1
        while (output.size() <= remainingLimit) {
            val value = input.read()
            if (value == -1) throw IllegalArgumentException("Unexpected end of request")
            if (previous == '\r'.code && value == '\n'.code) {
                val bytes = output.toByteArray()
                return if (bytes.isNotEmpty() && bytes.last() == '\r'.code.toByte()) bytes.copyOf(bytes.size - 1) else bytes
            }
            output.write(value)
            previous = value
        }
        throw IllegalArgumentException("HTTP line too long")
    }

    private fun respond(socket: java.net.Socket, code: Int, body: JSONObject) {
        val bytes = body.toString().toByteArray(StandardCharsets.UTF_8)
        val reason = when (code) {
            200 -> "OK"
            400 -> "Bad Request"
            403 -> "Forbidden"
            404 -> "Not Found"
            413 -> "Payload Too Large"
            429 -> "Too Many Requests"
            431 -> "Request Header Fields Too Large"
            else -> "Error"
        }
        val output = DataOutputStream(socket.getOutputStream())
        output.write("HTTP/1.1 $code $reason\r\n".toByteArray(StandardCharsets.US_ASCII))
        output.write("Content-Type: application/json; charset=utf-8\r\n".toByteArray(StandardCharsets.US_ASCII))
        output.write("Content-Length: ${bytes.size}\r\n".toByteArray(StandardCharsets.US_ASCII))
        output.write("Connection: close\r\n\r\n".toByteArray(StandardCharsets.US_ASCII))
        output.write(bytes)
        output.flush()
    }

    private fun errorJson(message: String) = JSONObject().put("recorded", false).put("error", message)

    private data class FailureWindow(val startedAtMillis: Long, val count: Int)

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "rollcall_local_attendance_tls"
        const val CERTIFICATE_CLOCK_SKEW_MILLIS = 60_000L
        const val CERTIFICATE_LIFETIME_MILLIS = 365L * 24 * 60 * 60 * 1000
        const val BACKLOG = 64
        const val WORKER_MIN = 4
        const val WORKER_MAX = 8
        const val QUEUE_CAPACITY = 64
        const val SOCKET_TIMEOUT_MILLIS = 5_000
        const val MAX_HEADER_BYTES = 8 * 1024
        const val MAX_BODY_BYTES = 4 * 1024
        const val MAX_FAILURES_PER_WINDOW = 8
        const val FAILURE_WINDOW_MILLIS = 60_000L
    }
}
