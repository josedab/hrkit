package dev.hrkit

/**
 * Parsed Heart Rate Measurement (BLE Service 0x180D, Char 0x2A37).
 * Mirrors HRPacket from @hrkit/core.
 */
data class HRPacket(
    /** Heart rate in beats per minute. */
    val hr: Int,
    /** RR intervals in milliseconds (converted from BLE 1/1024s units). */
    val rrIntervals: List<Double>,
    /** True if skin contact is detected; true when device doesn't support detection. */
    val contactDetected: Boolean,
    /** Cumulative energy expended in kJ if reported. */
    val energyExpended: Int?,
    /** Capture timestamp (epoch ms). */
    val timestamp: Long,
)

sealed class HRKitException(message: String) : RuntimeException(message) {
    object Empty : HRKitException("empty payload")
    class Malformed(reason: String) : HRKitException("malformed: $reason")
}

/**
 * Zero-allocation-on-success parser for the GATT Heart Rate Measurement
 * characteristic. RR conversion factor matches the JS impl: 1/1024s → ms
 * via `* 1000.0 / 1024.0`.
 */
object HeartRateParser {
    fun parse(data: ByteArray, timestamp: Long): HRPacket {
        if (data.isEmpty()) throw HRKitException.Empty
        val flags = data[0].toInt() and 0xFF
        val hr16 = flags and 0x01 != 0
        val contactSupported = flags and 0x04 != 0
        val contactDetected = !contactSupported || (flags and 0x02 != 0)
        val energyPresent = flags and 0x08 != 0
        val rrPresent = flags and 0x10 != 0

        var idx = 1
        val hr: Int = if (hr16) {
            if (data.size < idx + 2) throw HRKitException.Malformed("hr16 truncated")
            ((data[idx].toInt() and 0xFF) or ((data[idx + 1].toInt() and 0xFF) shl 8)).also { idx += 2 }
        } else {
            if (data.size < idx + 1) throw HRKitException.Malformed("hr8 truncated")
            (data[idx].toInt() and 0xFF).also { idx += 1 }
        }

        var energy: Int? = null
        if (energyPresent) {
            if (data.size < idx + 2) throw HRKitException.Malformed("energy truncated")
            energy = (data[idx].toInt() and 0xFF) or ((data[idx + 1].toInt() and 0xFF) shl 8)
            idx += 2
        }

        val rrs = mutableListOf<Double>()
        if (rrPresent) {
            while (idx + 1 < data.size) {
                val raw = (data[idx].toInt() and 0xFF) or ((data[idx + 1].toInt() and 0xFF) shl 8)
                rrs.add(raw * 1000.0 / 1024.0)
                idx += 2
            }
        }

        return HRPacket(hr, rrs, contactDetected, energy, timestamp)
    }
}
