import QtQuick
import Quickshell
import Quickshell.Io

Scope {
    readonly property string signalLevel: "0%"

    Process {
        id: wifiInfoProc
        command: ["sh", "-c", "nmcli -t -f ACTIVE,SSID,SIGNAL dev wifi | grep '^yes' | cut -d: -f2,3"]
        
        stdout: StdioCollector {
            onStreamFinished: {
                let output = text.trim();
                if (output) {
                    let parts = output.split(":");
                    signalLevel = (parts[1] || "0") + "%";
                } else {
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
}
