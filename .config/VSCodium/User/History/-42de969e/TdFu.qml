pragma Singleton

import Quickshell
import Quickshell.Io
import QtQuick

Singleton {
    id: root
    property int power: 100

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
        interval: 1000
        running: true
        repeat: true
        triggeredOnStart: true
        onTriggered: wifiSignalProc.running = true
    }
}