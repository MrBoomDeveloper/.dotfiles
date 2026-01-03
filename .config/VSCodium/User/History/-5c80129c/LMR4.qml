

Scope {
    // 0 = Not connected, 4 = Best signal
    property int signalLevel: 0

    Process {
        id: wifiSignalProc
        // Fetches signal % and divides by 25 to get a 0-4 range
        command: ["sh", "-c", "nmcli -t -f ACTIVE,SIGNAL dev wifi | grep '^yes' | cut -d: -f2 | awk '{print int($1/25)}'"]
        
        stdout: StdioCollector {
            onStreamFinished: {
                let output = text.trim();
                signalLevel = output !== "" ? parseInt(output) : 0;
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
