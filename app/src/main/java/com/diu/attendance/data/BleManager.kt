package com.diu.attendance.data

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import androidx.core.content.ContextCompat
import java.nio.charset.StandardCharsets
import java.util.UUID

enum class BleStatus {
    ACTIVE,
    DISABLED,
    UNSUPPORTED,
    NO_PERMISSION
}

class BleManager(private val context: Context) {

    companion object {
        val SERVICE_UUID: UUID = UUID.fromString("0000fe55-0000-1000-8000-00805f9b34fb")
    }

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        manager?.adapter
    }

    fun status(requireAdvertise: Boolean = false): BleStatus {
        val adapter = bluetoothAdapter ?: return BleStatus.UNSUPPORTED
        if (!adapter.isEnabled) return BleStatus.DISABLED

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val hasScan = ContextCompat.checkSelfPermission(context, android.Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
            val hasConnect = ContextCompat.checkSelfPermission(context, android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            val hasAdvertise = !requireAdvertise ||
                ContextCompat.checkSelfPermission(context, android.Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED
            if (!hasScan || !hasConnect || !hasAdvertise) return BleStatus.NO_PERMISSION
        } else {
            val hasLocation = ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (!hasLocation) return BleStatus.NO_PERMISSION
        }

        return BleStatus.ACTIVE
    }

    // BLE carries discovery metadata only. Attendance requests use the future local-network transport.
    private var advertiser: BluetoothLeAdvertiser? = null

    @SuppressLint("MissingPermission")
    fun startAdvertising(session: ActiveClassSession) {
        if (status(requireAdvertise = true) != BleStatus.ACTIVE) return

        advertiser = bluetoothAdapter?.bluetoothLeAdvertiser ?: return

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setConnectable(false)
            .setTimeout(0)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .build()

        val payloadData = "${session.courseCode}|${session.section}|${session.room}".toByteArray(StandardCharsets.UTF_8)

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(ParcelUuid(SERVICE_UUID))
            .addServiceData(ParcelUuid(SERVICE_UUID), payloadData)
            .build()

        advertiser?.startAdvertising(settings, data, advertiseCallback)
    }

    @SuppressLint("MissingPermission")
    fun stopAdvertising() {
        advertiser?.stopAdvertising(advertiseCallback)
        advertiser = null
    }

    private val advertiseCallback = object : AdvertiseCallback() {}

    // Student Scanning & Transmission
    private var scanner: BluetoothLeScanner? = null
    var onSessionDiscovered: ((ActiveClassSession) -> Unit)? = null

    @SuppressLint("MissingPermission")
    fun startScanning() {
        if (status() != BleStatus.ACTIVE) return
        scanner = bluetoothAdapter?.bluetoothLeScanner ?: return

        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(SERVICE_UUID))
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanner?.startScan(listOf(filter), settings, scanCallback)
    }

    @SuppressLint("MissingPermission")
    fun stopScanning() {
        scanner?.stopScan(scanCallback)
        scanner = null
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            super.onScanResult(callbackType, result)
            val serviceData = result?.scanRecord?.getServiceData(ParcelUuid(SERVICE_UUID)) ?: return
            val payloadStr = String(serviceData, StandardCharsets.UTF_8)
            val parts = payloadStr.split("|")
            if (parts.size >= 3) {
                val session = ActiveClassSession(
                    sessionId = "ble:${parts[0]}:${parts[1]}:${parts[2]}",
                    courseCode = parts[0],
                    courseName = "Nearby Class",
                    section = parts[1],
                    room = parts[2],
                    teacherName = "Teacher Host",
                    expiresAtMillis = System.currentTimeMillis() + 2 * 60 * 1000L,
                )
                onSessionDiscovered?.invoke(session)
            }
        }
    }
}
