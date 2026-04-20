import XCTest
@testable import HRKit

final class HeartRateParserTests: XCTestCase {
    func testParsesHr8WithSingleRR() throws {
        // Polar H10 baseline: flags=0x10 (RR present), hr=75, rr=1024 (= 1000 ms).
        let bytes: [UInt8] = [0x10, 0x4B, 0x00, 0x04]
        let packet = try HeartRateParser.parse(Data(bytes), timestamp: 0)
        XCTAssertEqual(packet.hr, 75)
        XCTAssertEqual(packet.rrIntervals.count, 1)
        XCTAssertEqual(packet.rrIntervals[0], 1000.0, accuracy: 0.001)
        XCTAssertTrue(packet.contactDetected)
    }

    func testRejectsEmpty() {
        XCTAssertThrowsError(try HeartRateParser.parse(Data(), timestamp: 0)) { err in
            XCTAssertEqual(err as? HRKitError, .empty)
        }
    }
}
