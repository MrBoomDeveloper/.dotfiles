pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io

Singleton {
    id: root
    property int signalLevel: 0

    Process {
        id: wifiSignalProc
        command: ["sh", "-c", "nmcli -t -f ACTIVE,SIGNAL dev wifi | grep '^yes' | cut -d: -f2 | awk '{print int($1/25)}'"]
        
        stdout: StdioCollector {
            onStreamFinished: {
                let output = text.trim();
                root.signalLevel = output !== "" ? parseInt(output) : 0;
            }
        }
    }

    Timer {
        interval: 5000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: wifiSignalProc.running = true
    }
}