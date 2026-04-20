// HRKit Android — Kotlin binding wrapping android.bluetooth.* and exposing
// the same HR/HRV/zone primitives as @hrkit/core.
//
// Status: SCAFFOLD. Parser + unit tests build with Gradle 8.x + JDK 17.
// Wire BluetoothLeScanner once paired with a real-device test rig.

plugins {
    kotlin("jvm") version "1.9.22"
    `java-library`
    `maven-publish`
}

group = "dev.hrkit"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
}

tasks.test {
    useJUnitPlatform()
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
    withSourcesJar()
}

publishing {
    publications {
        create<MavenPublication>("library") {
            from(components["java"])
            pom {
                name.set("HRKit Android")
                description.set("Native Android binding for @hrkit — BLE heart-rate sensor SDK.")
                url.set("https://github.com/josedab/hrkit")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://github.com/josedab/hrkit/blob/main/LICENSE")
                    }
                }
            }
        }
    }
}
