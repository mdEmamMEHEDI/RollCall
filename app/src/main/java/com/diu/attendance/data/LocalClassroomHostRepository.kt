package com.diu.attendance.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class LocalHostDetails(
    val networkMode: String,
    val ssid: String?,
    val passphrase: String?,
    val port: Int,
)

class LocalHostStartException(
    message: String,
    val canUseCurrentWifi: Boolean = false,
) : Exception(message)

interface LocalClassroomHostRepository {
    suspend fun startOnLocalOnlyHotspot(
        session: AttendanceSession,
        sessions: AttendanceSessionRepository,
        onDiscoveryStatus: (String) -> Unit,
        onHostFailure: (String) -> Unit,
    ): LocalHostDetails

    suspend fun startOnCurrentWifi(
        session: AttendanceSession,
        sessions: AttendanceSessionRepository,
        onDiscoveryStatus: (String) -> Unit,
    ): LocalHostDetails

    suspend fun stop()
}

class AndroidLocalClassroomHostRepository(context: Context) : LocalClassroomHostRepository {
    private val appContext = context.applicationContext
    private val wifiManager = appContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
    private val connectivityManager =
        appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val nsdManager = appContext.getSystemService(Context.NSD_SERVICE) as NsdManager

    private var reservation: WifiManager.LocalOnlyHotspotReservation? = null
    private var server: LocalAttendanceHttpServer? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryCallback: ((String) -> Unit)? = null
    private val stopping = AtomicBoolean(false)
    @Volatile private var hostGeneration = 0L

    override suspend fun startOnLocalOnlyHotspot(
        session: AttendanceSession,
        sessions: AttendanceSessionRepository,
        onDiscoveryStatus: (String) -> Unit,
        onHostFailure: (String) -> Unit,
    ): LocalHostDetails = withContext(Dispatchers.IO) {
        stop()
        checkNetworkPermission()
        val generation = ++hostGeneration
        if (!appContext.packageManager.hasSystemFeature(PackageManager.FEATURE_WIFI) || wifiManager == null) {
            throw LocalHostStartException(
                "This device does not provide Wi-Fi hotspot support.",
                canUseCurrentWifi = true,
            )
        }

        val hotspotReservation = try {
            withTimeout(HOTSPOT_START_TIMEOUT_MILLIS) {
                requestLocalOnlyHotspot {
                    if (hostGeneration == generation && !stopping.get()) {
                        onHostFailure("Android stopped the local-only hotspot.")
                    }
                }
            }
        } catch (error: Exception) {
            throw LocalHostStartException(
                error.message ?: "Android could not start a local-only hotspot.",
                canUseCurrentWifi = true,
            )
        }
        reservation = hotspotReservation

        try {
            val config = hotspotCredentials(hotspotReservation)
            startServerAndDiscovery(session, sessions, onDiscoveryStatus)
            LocalHostDetails(
                networkMode = "RollCall local-only Wi-Fi",
                ssid = config.first,
                passphrase = config.second,
                port = server?.port ?: error("Local server did not start"),
            )
        } catch (error: Exception) {
            stop()
            throw LocalHostStartException(
                error.message ?: "Could not start the local classroom service.",
                canUseCurrentWifi = true,
            )
        }
    }

    override suspend fun startOnCurrentWifi(
        session: AttendanceSession,
        sessions: AttendanceSessionRepository,
        onDiscoveryStatus: (String) -> Unit,
    ): LocalHostDetails = withContext(Dispatchers.IO) {
        stop()
        checkNetworkPermission()
        if (!isConnectedToWifi()) {
            throw LocalHostStartException(
                "Connect this phone to Wi-Fi first, then choose Use current Wi-Fi.",
                canUseCurrentWifi = true,
            )
        }
        try {
            startServerAndDiscovery(session, sessions, onDiscoveryStatus)
            LocalHostDetails(
                networkMode = "Existing Wi-Fi network",
                ssid = null,
                passphrase = null,
                port = server?.port ?: error("Local server did not start"),
            )
        } catch (error: Exception) {
            stop()
            throw LocalHostStartException(
                error.message ?: "Could not start the local classroom service.",
                canUseCurrentWifi = false,
            )
        }
    }

    override suspend fun stop() = withContext(Dispatchers.IO) {
        hostGeneration += 1
        stopping.set(true)
        discoveryCallback?.invoke("Service stopped")
        discoveryCallback = null
        registrationListener?.let { listener ->
            runCatching { nsdManager.unregisterService(listener) }
        }
        registrationListener = null
        server?.stop()
        server = null
        reservation?.close()
        reservation = null
        stopping.set(false)
    }

    private fun startServerAndDiscovery(
        session: AttendanceSession,
        sessions: AttendanceSessionRepository,
        onDiscoveryStatus: (String) -> Unit,
    ) {
        discoveryCallback = onDiscoveryStatus
        server = LocalAttendanceHttpServer(sessions).also { it.start() }
        onDiscoveryStatus("Registering RollCall service…")
        val info = NsdServiceInfo().apply {
            serviceName = "RollCall-${session.id.take(8)}"
            serviceType = SERVICE_TYPE
            port = server!!.port
            setAttribute("sessionId", session.id)
            setAttribute("cert", server!!.certificateFingerprint)
            setAttribute("course", session.courseCode.take(50))
            setAttribute("section", session.section.take(20))
            setAttribute("room", session.room.take(50))
        }
        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {
                discoveryCallback?.invoke("Discoverable on the local network")
            }

            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                discoveryCallback?.invoke(
                    "Network discovery unavailable (code $errorCode). Students may need manual connection."
                )
            }

            override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {
                if (!stopping.get()) discoveryCallback?.invoke("Service advertisement stopped")
            }

            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                if (!stopping.get()) {
                    discoveryCallback?.invoke("Could not unregister network discovery (code $errorCode)")
                }
            }
        }
        registrationListener = listener
        nsdManager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
    }

    private fun isConnectedToWifi(): Boolean =
        connectivityManager.allNetworks.any { network ->
            connectivityManager.getNetworkCapabilities(network)
                ?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        }

    private fun checkNetworkPermission() {
        val permission = if (Build.VERSION.SDK_INT >= 33) {
            Manifest.permission.NEARBY_WIFI_DEVICES
        } else {
            Manifest.permission.ACCESS_FINE_LOCATION
        }
        if (ContextCompat.checkSelfPermission(appContext, permission) != PackageManager.PERMISSION_GRANTED) {
            val permissionName = if (Build.VERSION.SDK_INT >= 33) {
                "Nearby Wi-Fi devices"
            } else {
                "Location (required by Android Wi-Fi hotspot APIs)"
            }
            throw LocalHostStartException("Allow $permissionName permission to start classroom hosting.")
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun requestLocalOnlyHotspot(onUnexpectedStop: () -> Unit): WifiManager.LocalOnlyHotspotReservation =
        suspendCancellableCoroutine { continuation ->
            val callback = object : WifiManager.LocalOnlyHotspotCallback() {
                override fun onStopped() {
                    if (!stopping.get()) onUnexpectedStop()
                }
                override fun onStarted(reservation: WifiManager.LocalOnlyHotspotReservation) {
                    if (continuation.isActive) continuation.resume(reservation) else reservation.close()
                }

                override fun onFailed(reason: Int) {
                    if (!continuation.isActive) return
                    val message = when (reason) {
                        ERROR_NO_CHANNEL -> "Android could not find a Wi-Fi channel for its local hotspot."
                        ERROR_INCOMPATIBLE_MODE -> "Turn off Wi-Fi Direct or another hotspot, then retry."
                        ERROR_TETHERING_DISALLOWED -> "This device or administrator does not allow hotspot creation."
                        else -> "Android could not start its local-only hotspot (reason $reason)."
                    }
                    continuation.resumeWithException(IllegalStateException(message))
                }
            }
            try {
                wifiManager?.startLocalOnlyHotspot(callback, Handler(Looper.getMainLooper()))
                    ?: continuation.resumeWithException(IllegalStateException("Wi-Fi service is unavailable."))
            } catch (error: SecurityException) {
                continuation.resumeWithException(error)
            } catch (error: IllegalStateException) {
                continuation.resumeWithException(error)
            }
            continuation.invokeOnCancellation {
                runCatching { wifiManager?.cancelLocalOnlyHotspotRequest() }
            }
        }

    @Suppress("DEPRECATION")
    private fun hotspotCredentials(reservation: WifiManager.LocalOnlyHotspotReservation): Pair<String?, String?> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val config = reservation.softApConfiguration
            config.ssid to config.passphrase
        } else {
            val config = reservation.wifiConfiguration
            config.SSID?.trim('"') to config.preSharedKey?.trim('"')
        }
    }

    private companion object {
        const val SERVICE_TYPE = "_rollcall._tcp."
        const val HOTSPOT_START_TIMEOUT_MILLIS = 25_000L
    }
}
