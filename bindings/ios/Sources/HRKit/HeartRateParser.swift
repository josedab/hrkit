import Foundation

/// Parsed Heart Rate Measurement (BLE Service 0x180D, Char 0x2A37).
/// Mirrors `HRPacket` from `@hrkit/core`.
public struct HRPacket: Equatable {
    /// Heart rate in beats per minute.
    public let hr: Int
    /// RR intervals in milliseconds (converted from BLE 1/1024s units).
    public let rrIntervals: [Double]
    /// `true` if skin contact is detected. `true` when device does not support detection.
    public let contactDetected: Bool
    /// Cumulative energy expended in kJ if reported.
    public let energyExpended: UInt16?
    /// Capture timestamp (seconds since reference).
    public let timestamp: TimeInterval

    public init(
        hr: Int,
        rrIntervals: [Double],
        contactDetected: Bool,
        energyExpended: UInt16?,
        timestamp: TimeInterval
    ) {
        self.hr = hr
        self.rrIntervals = rrIntervals
        self.contactDetected = contactDetected
        self.energyExpended = energyExpended
        self.timestamp = timestamp
    }
}

public enum HRKitError: Error, Equatable {
    case empty
    case malformed(String)
}

/// Zero-allocation parser for the GATT Heart Rate Measurement characteristic.
/// Identical conversion factor to JS impl: RR in 1/1024 s → ms via `* 1000.0/1024.0`.
public enum HeartRateParser {
    public static func parse(_ data: Data, timestamp: TimeInterval) throws -> HRPacket {
        guard !data.isEmpty else { throw HRKitError.empty }

        let flags = data[0]
        let hr16 = (flags & 0x01) != 0
        let contactSupported = (flags & 0x04) != 0
        let contactDetected = !contactSupported || (flags & 0x02) != 0
        let energyPresent = (flags & 0x08) != 0
        let rrPresent = (flags & 0x10) != 0

        var idx = 1
        let hr: Int
        if hr16 {
            guard data.count >= idx + 2 else { throw HRKitError.malformed("hr16 truncated") }
            hr = Int(data[idx]) | (Int(data[idx + 1]) << 8)
            idx += 2
        } else {
            guard data.count >= idx + 1 else { throw HRKitError.malformed("hr8 truncated") }
            hr = Int(data[idx])
            idx += 1
        }

        var energy: UInt16? = nil
        if energyPresent {
            guard data.count >= idx + 2 else { throw HRKitError.malformed("energy truncated") }
            energy = UInt16(data[idx]) | (UInt16(data[idx + 1]) << 8)
            idx += 2
        }

        var rrs: [Double] = []
        if rrPresent {
            while idx + 1 < data.count {
                let raw = UInt16(data[idx]) | (UInt16(data[idx + 1]) << 8)
                rrs.append(Double(raw) * 1000.0 / 1024.0)
                idx += 2
            }
        }

        return HRPacket(
            hr: hr,
            rrIntervals: rrs,
            contactDetected: contactDetected,
            energyExpended: energy,
            timestamp: timestamp
        )
    }
}
