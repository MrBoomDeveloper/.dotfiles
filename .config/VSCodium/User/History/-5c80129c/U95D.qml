import QtQuick
import Quickshell
import Quickshell.Io

Scope {
    property string ssid: "Disconnected"
    property string signalLevel: "0%"

    Process {
        id: wifiInfoProc
        // Returns "SSID:SIGNAL" for the active connection
        command: ["sh", "-c", "nmcli -t -f ACTIVE,SSID,SIGNAL dev wifi | grep '^yes' | cut -d: -f2,3"]
        
        stdout: StdioCollector {
            onStreamFinished: {
                let output = text.trim();
                if (output) {
                    let parts = output.split(":");
                    ssid = parts[0] || "Unknown";
                    signalLevel = (parts[1] || "0") + "%";
                } else {
                    ssid = "Disconnected";
                    signalLevel = "0%";
                }
            }
        }
    }

    Timer {
        interval: 5000 
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: wifiInfoProc.running = true
    }

    // Example UI
    Column {
        Text { text: "Network: " + ssid; color: "white" }
        Text { text: "Strength: " + signalLevel; color: "white" }
    }
}
