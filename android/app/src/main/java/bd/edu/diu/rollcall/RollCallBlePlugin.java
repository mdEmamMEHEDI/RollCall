package bd.edu.diu.rollcall;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.os.Build;
import android.os.ParcelUuid;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * RollCall BLE: connectionless advertising + scanning (see src/services/ble.ts for the protocol).
 * JS sends/receives 16-bit service data as hex strings; all crypto lives in JS.
 */
@CapacitorPlugin(
    name = "RollCallBle",
    permissions = {
        @Permission(alias = "ble", strings = {
            Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT
        }),
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class RollCallBlePlugin extends Plugin {
    private final Map<String, AdvertiseCallback> adverts = new HashMap<>();
    private ScanCallback scanCallback;

    private BluetoothAdapter adapter() {
        BluetoothManager m = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return m == null ? null : m.getAdapter();
    }

    private String permAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "ble" : "location";
    }

    private JSObject state() {
        BluetoothAdapter a = adapter();
        boolean location = true;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            // Android 11 and older need Location turned on to see BLE devices
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            location = lm != null && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
        }
        JSObject o = new JSObject();
        o.put("bluetooth", a != null && a.isEnabled());
        o.put("location", location);
        o.put("nearby", getPermissionState(permAlias()) == PermissionState.GRANTED);
        o.put("canAdvertise", a != null && a.isEnabled() && a.getBluetoothLeAdvertiser() != null);
        return o;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(state());
    }

    /** Asks for the permission, then for Bluetooth on. Resolves with the final state. */
    @PluginMethod
    public void prepare(PluginCall call) {
        if (getPermissionState(permAlias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(permAlias(), call, "permDone");
        } else {
            askBluetooth(call);
        }
    }

    @PermissionCallback
    private void permDone(PluginCall call) {
        if (getPermissionState(permAlias()) != PermissionState.GRANTED) {
            call.resolve(state());
            return;
        }
        askBluetooth(call);
    }

    @SuppressLint("MissingPermission")
    private void askBluetooth(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a != null && !a.isEnabled()) {
            startActivityForResult(call, new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "btDone");
        } else {
            call.resolve(state());
        }
    }

    @ActivityCallback
    private void btDone(PluginCall call, ActivityResult result) {
        call.resolve(state());
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        Intent i = new Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    private static ParcelUuid uuid16(String hex4) {
        return ParcelUuid.fromString("0000" + hex4.toLowerCase() + "-0000-1000-8000-00805f9b34fb");
    }

    private static byte[] fromHex(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return b;
    }

    private static String toHex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private static AdvertiseData build(JSObject data) {
        AdvertiseData.Builder b = new AdvertiseData.Builder().setIncludeDeviceName(false).setIncludeTxPowerLevel(false);
        if (data == null) return b.build();
        Iterator<String> keys = data.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            b.addServiceData(uuid16(k), fromHex(data.getString(k)));
        }
        return b.build();
    }

    /** advertise({ slot, data: { "1c01": "hex" }, scanResponse?: { "1c03": "hex" } }) replaces the advert in that slot. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void advertise(PluginCall call) {
        BluetoothAdapter a = adapter();
        BluetoothLeAdvertiser adv = a == null ? null : a.getBluetoothLeAdvertiser();
        if (adv == null) {
            call.reject("Bluetooth is off or this phone can't advertise");
            return;
        }
        String slot = call.getString("slot", "main");
        stopSlot(adv, slot);
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(false)
            .setTimeout(0)
            .build();
        AdvertiseCallback cb = new AdvertiseCallback() {
            @Override
            public void onStartSuccess(AdvertiseSettings s) {}

            @Override
            public void onStartFailure(int errorCode) {
                JSObject e = new JSObject();
                e.put("slot", slot);
                e.put("code", errorCode);
                notifyListeners("advertiseError", e);
            }
        };
        adverts.put(slot, cb);
        JSObject sr = call.getObject("scanResponse");
        try {
            if (sr != null) adv.startAdvertising(settings, build(call.getObject("data")), build(sr), cb);
            else adv.startAdvertising(settings, build(call.getObject("data")), cb);
            call.resolve();
        } catch (Exception ex) {
            adverts.remove(slot);
            call.reject(ex.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    private void stopSlot(BluetoothLeAdvertiser adv, String slot) {
        AdvertiseCallback old = adverts.remove(slot);
        if (old != null && adv != null) {
            try {
                adv.stopAdvertising(old);
            } catch (Exception ignored) {}
        }
    }

    @PluginMethod
    public void stopAdvertise(PluginCall call) {
        BluetoothAdapter a = adapter();
        BluetoothLeAdvertiser adv = a == null ? null : a.getBluetoothLeAdvertiser();
        String slot = call.getString("slot");
        if (slot == null) {
            for (String s : adverts.keySet().toArray(new String[0])) stopSlot(adv, s);
        } else stopSlot(adv, slot);
        call.resolve();
    }

    /** Emits "packet" { address, rssi, data: { uuid16: hex } } for every advert carrying RollCall service data. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void startScan(PluginCall call) {
        BluetoothAdapter a = adapter();
        BluetoothLeScanner scanner = a == null ? null : a.getBluetoothLeScanner();
        if (scanner == null) {
            call.reject("Bluetooth is off");
            return;
        }
        if (scanCallback != null) {
            call.resolve();
            return;
        }
        scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult r) {
                ScanRecord rec = r.getScanRecord();
                if (rec == null || rec.getServiceData() == null || rec.getServiceData().isEmpty()) return;
                JSObject data = new JSObject();
                boolean ours = false;
                for (Map.Entry<ParcelUuid, byte[]> e : rec.getServiceData().entrySet()) {
                    String u = e.getKey().toString();
                    String short16 = u.substring(4, 8);
                    if (!short16.startsWith("1c0")) continue;
                    ours = true;
                    data.put(short16, toHex(e.getValue()));
                }
                if (!ours) return;
                JSObject o = new JSObject();
                o.put("address", r.getDevice().getAddress());
                o.put("rssi", r.getRssi());
                o.put("data", data);
                notifyListeners("packet", o);
            }

            @Override
            public void onScanFailed(int errorCode) {
                JSObject e = new JSObject();
                e.put("code", errorCode);
                notifyListeners("scanError", e);
                scanCallback = null;
            }
        };
        ScanSettings s = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .setReportDelay(0)
            .build();
        scanner.startScan(null, s, scanCallback);
        call.resolve();
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void stopScan(PluginCall call) {
        BluetoothAdapter a = adapter();
        BluetoothLeScanner scanner = a == null ? null : a.getBluetoothLeScanner();
        if (scanner != null && scanCallback != null) {
            try {
                scanner.stopScan(scanCallback);
            } catch (Exception ignored) {}
        }
        scanCallback = null;
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        BluetoothAdapter a = adapter();
        if (a != null) {
            BluetoothLeAdvertiser adv = a.getBluetoothLeAdvertiser();
            for (String s : adverts.keySet().toArray(new String[0])) stopSlot(adv, s);
            BluetoothLeScanner sc = a.getBluetoothLeScanner();
            if (sc != null && scanCallback != null) {
                try {
                    sc.stopScan(scanCallback);
                } catch (Exception ignored) {}
            }
        }
    }
}
