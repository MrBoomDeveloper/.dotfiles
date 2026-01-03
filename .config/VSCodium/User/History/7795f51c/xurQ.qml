import Quickshell
import Quickshell.Io
import QtQuick

Scope {
    property string time

    Process {
        id: dateProcess
        command: ["date"]
        running: true

        stdout: StdioCollector {
            onStreamFinished: time = this.text
        }
    }

    Timer {
        interval: 1000
        running: true
        repeat: true
        onTriggered: dateProcess.running = true
    }
}