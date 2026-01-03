import QtQuick

Scope {
    Text {
        text: Time.time
        color: "#ffffff"
    }

    SystemClock {
        id: clock
        precision: SystemClock.Minutes
    }
}