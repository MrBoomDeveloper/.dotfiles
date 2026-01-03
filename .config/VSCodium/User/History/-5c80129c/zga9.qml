import Quickshell
import quickshell.services.shell
import QtQuick

Scope {
    readonly property string a: ""

    ShellScript {
    id: wifiStateScript
    command: "nmcli -t -f WIFI,STATE device | grep '^enabled' | cut -d: -f2"
    interval: 5000 // Update every 5 seconds
    onFinished: {
        // Handle the output (e.g., "connected")
        console.log("WiFi State: " + output.trim())
    }
}
}