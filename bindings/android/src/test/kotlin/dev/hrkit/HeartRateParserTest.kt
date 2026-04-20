package dev.hrkit

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class HeartRateParserTest {
    @Test
    fun parsesHr8WithSingleRR() {
        // Polar H10 baseline: flags=0x10, hr=75, rr=1024 (=1000 ms).
        val bytes = byteArrayOf(0x10, 0x4B, 0x00, 0x04)
        val packet = HeartRateParser.parse(bytes, 0L)
        assertEquals(75, packet.hr)
        assertEquals(1, packet.rrIntervals.size)
        assertEquals(1000.0, packet.rrIntervals[0], 0.001)
        assertTrue(packet.contactDetected)
    }

    @Test
    fun rejectsEmpty() {
        assertThrows<HRKitException.Empty> { HeartRateParser.parse(byteArrayOf(), 0L) }
    }
}
