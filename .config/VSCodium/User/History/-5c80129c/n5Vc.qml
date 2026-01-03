import Quickshell
import Quickshell.Io
import QtQuick

Scope {
    readonly property string wifiStatus: "checking..."

    // 1. Define the process to run the command
    Process {
        id: wifiProc
        command: ["sh", "-c", "nmcli -t -f WIFI,STATE device | grep '^enabled' | cut -d: -f2"]
        
        stdout: StdioCollector {
            onStreamFinished: {
                // Update the state when the command finishes
                wifiStatus = text.trim() || "unknown"
            }
        }
    }

    Timer {
        interval: 5000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: wifiProc.running = true
    }
}
