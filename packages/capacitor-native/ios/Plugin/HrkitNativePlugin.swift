import Foundation
import Capacitor
import CoreBluetooth

/**
 * HrkitNative — direct CoreBluetooth bridge.
 *
 * Methods mirror the TypeScript `HrkitNativePlugin` interface. Events:
 *  - `scanResult`: { deviceId, name, rssi }
 *  - `gattNotification`: { deviceId, service, characteristic, hex }
 *  - `connectionStateChange`: { deviceId, connected }
 */
@objc(HrkitNativePlugin)
public class HrkitNativePlugin: CAPPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var central: CBCentralManager!
    private var peripherals: [String: CBPeripheral] = [:]
    private var pendingConnect: [String: CAPPluginCall] = [:]
    private var serviceFilter: [CBUUID] = []

    public override func load() {
        central = CBCentralManager(delegate: self, queue: nil)
    }

    @objc func startScan(_ call: CAPPluginCall) {
        let services = call.getArray("services", String.self) ?? ["180D"]
        serviceFilter = services.map { CBUUID(string: $0) }
        if central.state == .poweredOn {
            central.scanForPeripherals(withServices: serviceFilter, options: nil)
            call.resolve()
        } else {
            call.reject("Bluetooth not powered on")
        }
    }

    @objc func stopScan(_ call: CAPPluginCall) {
        central.stopScan()
        call.resolve()
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId"),
              let peripheral = peripherals[deviceId] else {
            call.reject("Unknown deviceId")
            return
        }
        pendingConnect[deviceId] = call
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId"),
              let peripheral = peripherals[deviceId] else {
            call.resolve()
            return
        }
        central.cancelPeripheralConnection(peripheral)
        call.resolve()
    }

    @objc func startNotifications(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId"),
              let serviceStr = call.getString("service"),
              let charStr = call.getString("characteristic"),
              let peripheral = peripherals[deviceId] else {
            call.reject("Missing args")
            return
        }
        let serviceUuid = CBUUID(string: serviceStr)
        let charUuid = CBUUID(string: charStr)
        if let svc = peripheral.services?.first(where: { $0.uuid == serviceUuid }),
           let ch = svc.characteristics?.first(where: { $0.uuid == charUuid }) {
            peripheral.setNotifyValue(true, for: ch)
        }
        call.resolve()
    }

    @objc func stopNotifications(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId"),
              let serviceStr = call.getString("service"),
              let charStr = call.getString("characteristic"),
              let peripheral = peripherals[deviceId] else {
            call.resolve()
            return
        }
        let serviceUuid = CBUUID(string: serviceStr)
        let charUuid = CBUUID(string: charStr)
        if let svc = peripheral.services?.first(where: { $0.uuid == serviceUuid }),
           let ch = svc.characteristics?.first(where: { $0.uuid == charUuid }) {
            peripheral.setNotifyValue(false, for: ch)
        }
        call.resolve()
    }

    // MARK: - CBCentralManagerDelegate

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {}

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let id = peripheral.identifier.uuidString
        peripherals[id] = peripheral
        notifyListeners("scanResult", data: [
            "deviceId": id,
            "name": peripheral.name ?? "",
            "rssi": RSSI.intValue,
        ])
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        let id = peripheral.identifier.uuidString
        notifyListeners("connectionStateChange", data: ["deviceId": id, "connected": true])
        if let call = pendingConnect.removeValue(forKey: id) {
            call.resolve(["deviceId": id, "name": peripheral.name ?? ""])
        }
        peripheral.discoverServices(serviceFilter.isEmpty ? nil : serviceFilter)
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        let id = peripheral.identifier.uuidString
        notifyListeners("connectionStateChange", data: ["deviceId": id, "connected": false])
    }

    // MARK: - CBPeripheralDelegate

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        for svc in peripheral.services ?? [] {
            peripheral.discoverCharacteristics(nil, for: svc)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        // characteristics are now ready for startNotifications calls
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard let data = characteristic.value else { return }
        let hex = data.map { String(format: "%02x", $0) }.joined()
        notifyListeners("gattNotification", data: [
            "deviceId": peripheral.identifier.uuidString,
            "service": characteristic.service?.uuid.uuidString ?? "",
            "characteristic": characteristic.uuid.uuidString,
            "hex": hex,
        ])
    }
}
