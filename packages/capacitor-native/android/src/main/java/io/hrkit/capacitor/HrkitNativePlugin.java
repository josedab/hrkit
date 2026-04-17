package io.hrkit.capacitor;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.ParcelUuid;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * HrkitNative — direct android.bluetooth bridge.
 * Mirrors the TS HrkitNativePlugin interface. Events:
 *   - scanResult { deviceId, name, rssi }
 *   - gattNotification { deviceId, service, characteristic, hex }
 *   - connectionStateChange { deviceId, connected }
 */
@CapacitorPlugin(name = "HrkitNative")
public class HrkitNativePlugin extends Plugin {
    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private final Map<String, BluetoothGatt> gatts = new HashMap<>();
    private final Map<String, PluginCall> pendingConnect = new HashMap<>();

    @Override
    public void load() {
        BluetoothManager mgr = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = mgr.getAdapter();
        if (adapter != null) scanner = adapter.getBluetoothLeScanner();
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        if (scanner == null) {
            call.reject("Bluetooth not available");
            return;
        }
        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build();
        scanner.startScan(null, settings, scanCallback);
        call.resolve();
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        if (scanner != null) scanner.stopScan(scanCallback);
        call.resolve();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String id = call.getString("deviceId");
        if (id == null) { call.reject("Missing deviceId"); return; }
        BluetoothDevice device = adapter.getRemoteDevice(id);
        pendingConnect.put(id, call);
        BluetoothGatt gatt = device.connectGatt(getContext(), false, gattCallback);
        gatts.put(id, gatt);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String id = call.getString("deviceId");
        BluetoothGatt gatt = gatts.remove(id);
        if (gatt != null) { gatt.disconnect(); gatt.close(); }
        call.resolve();
    }

    @PluginMethod
    public void startNotifications(PluginCall call) {
        String id = call.getString("deviceId");
        String service = call.getString("service");
        String characteristic = call.getString("characteristic");
        BluetoothGatt gatt = gatts.get(id);
        if (gatt == null) { call.reject("Not connected"); return; }
        BluetoothGattService svc = gatt.getService(UUID.fromString(expandUuid(service)));
        if (svc == null) { call.reject("Service not found"); return; }
        BluetoothGattCharacteristic ch = svc.getCharacteristic(UUID.fromString(expandUuid(characteristic)));
        if (ch == null) { call.reject("Characteristic not found"); return; }
        gatt.setCharacteristicNotification(ch, true);
        call.resolve();
    }

    @PluginMethod
    public void stopNotifications(PluginCall call) {
        String id = call.getString("deviceId");
        String service = call.getString("service");
        String characteristic = call.getString("characteristic");
        BluetoothGatt gatt = gatts.get(id);
        if (gatt == null) { call.resolve(); return; }
        BluetoothGattService svc = gatt.getService(UUID.fromString(expandUuid(service)));
        if (svc != null) {
            BluetoothGattCharacteristic ch = svc.getCharacteristic(UUID.fromString(expandUuid(characteristic)));
            if (ch != null) gatt.setCharacteristicNotification(ch, false);
        }
        call.resolve();
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            JSObject evt = new JSObject();
            evt.put("deviceId", result.getDevice().getAddress());
            evt.put("name", result.getDevice().getName() != null ? result.getDevice().getName() : "");
            evt.put("rssi", result.getRssi());
            notifyListeners("scanResult", evt);
        }
    };

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            String id = gatt.getDevice().getAddress();
            JSObject evt = new JSObject();
            evt.put("deviceId", id);
            evt.put("connected", newState == BluetoothProfile.STATE_CONNECTED);
            notifyListeners("connectionStateChange", evt);
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                gatt.discoverServices();
                PluginCall call = pendingConnect.remove(id);
                if (call != null) {
                    JSObject ret = new JSObject();
                    ret.put("deviceId", id);
                    ret.put("name", gatt.getDevice().getName() != null ? gatt.getDevice().getName() : "");
                    call.resolve(ret);
                }
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic ch) {
            byte[] data = ch.getValue();
            StringBuilder hex = new StringBuilder(data.length * 2);
            for (byte b : data) hex.append(String.format("%02x", b));
            JSObject evt = new JSObject();
            evt.put("deviceId", gatt.getDevice().getAddress());
            evt.put("service", ch.getService().getUuid().toString());
            evt.put("characteristic", ch.getUuid().toString());
            evt.put("hex", hex.toString());
            notifyListeners("gattNotification", evt);
        }
    };

    /** Expand a 16-bit shortcode like "180d" to a full 128-bit UUID string. */
    private static String expandUuid(String s) {
        if (s == null) return s;
        if (s.length() == 4) return "0000" + s.toLowerCase() + "-0000-1000-8000-00805f9b34fb";
        return s.toLowerCase();
    }
}
