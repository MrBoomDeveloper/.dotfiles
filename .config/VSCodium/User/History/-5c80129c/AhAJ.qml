import Quickshell
import Quickshell.Io
import QtQuick

Scope {
    readonly property string wifiStatus: "checking..."

    // 1. Define the process to run the command
    Process {
        id: wifiProc
        // Using sh -c allows you to use pipes like grep/awk
        command: ["sh", "-c", "nmcli -t -f WIFI,STATE device | grep '^enabled' | cut -d: -f2"]
        
        stdout: StdioCollector {
            onStreamFinished: {
                // Update the state when the command finishes
                wifiStatus = text.trim() || "unknown"
            }
        }
    }

    // 2. Use a Timer to trigger the process periodically
    Timer {
        interval: 5000 // Refresh every 5 seconds
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: wifiProc.running = true
    }

    // Example UI display
    Text {
        text: "WiFi: " + wifiStatus
        color: "white"
    }
}
