import Quickshell
import Quickshell.Widgets
import QtQuick.Layouts
import Quickshell.Hyprland
import Quickshell.Io
import QtQuick
import Qt5Compat.GraphicalEffects

Scope {
    Variants {
        model: Quickshell.screens

        PanelWindow {
            required property var modelData
            screen: modelData
            implicitHeight: 32
            color: '#14071c'

            anchors {
                top: true
                left: true
                right: true
            }

            WrapperItem {
                width: parent.width
                height: parent.height
                margin: 4
                
                Row {
                    height: parent.height
                    width: parent.width

                    Row {
                        height: parent.height

                        Repeater {
                            model: Hyprland.workspaces
                            delegate: ClippingWrapperRectangle {
                                height: parent.height
                                width: parent.height * 1.1
                                radius: 4
                                color: modelData.active ? "#facff3" : "transparent"
                        
                                Item {
                                    Text { 
                                        text: modelData.id 
                                        color: modelData.active ? "#140c13" : "#facff3"
                                        anchors.centerIn: parent
                                    }

                                    MouseArea {
                                        anchors.fill: parent
                                        cursorShape: modelData.active ? Qt.ArrowCursor : Qt.PointingHandCursor 
                                        onClicked: Hyprland.dispatch(`workspace ${modelData.id}`)
                                    }
                                }
                            }
                        }
                    }

                    Row {
                        height: parent.height
                        anchors.right: parent.right
                        spacing: 2

                        ClockWidget {
                            anchors.verticalCenter: parent.verticalCenter
                        }

                        Text { text: "  " }

                        Item {
                            height: parent.height
                            width: parent.height

                            Image {
                                source: "./wifi.svg"
                                height: parent.height - 8
                                width: parent.height - 8
                                anchors.centerIn: parent
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor 
                                onClicked: wifiOnClick.running = true
                            }

                            Process {
                                id: wifiOnClick
                                command: ["kitty", "nmtui"]
                            }

                            function getWifiIcon(power) {
            switch (power) {
                case 0:  return "wifi.svg";
                case 1:  return "icons/wifi_low.png";
                case 2:  return "icons/wifi_med.png";
                case 3:  return "icons/wifi_high.png";
                case 4:  return "icons/wifi_full.png";
                default: return "icons/wifi_error.png";
            }
        }
                        }

                        Item {
                            height: parent.height
                            width: parent.height

                            Image {
                                source: "./bluetooth.svg"
                                height: parent.height - 7
                                width: parent.height - 7
                                anchors.centerIn: parent
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor 
                                onClicked: bluetoothOnClick.running = true
                            }

                            Process {
                                id: bluetoothOnClick
                                command: ["rofi-bluetooth", "-theme", ".config/rofi/launcher-style.rasi"]
                            }
                        }

                        Item {
                            height: parent.height
                            width: parent.height

                            Image {
                                source: "./ic_volume.svg"
                                height: parent.height - 5
                                width: parent.height - 5
                                anchors.centerIn: parent
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor 
                                onClicked: volumeOnClick.running = true
                            }

                            Process {
                                id: volumeOnClick
                                command: ["rofi-bluetooth", "-theme", ".config/rofi/launcher-style.rasi"]
                            }
                        }

                        Item {
                            height: parent.height
                            width: parent.height

                            Image {
                                source: "./brightness_7.svg"
                                height: parent.height - 8
                                width: parent.height - 8
                                anchors.centerIn: parent
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor 
                                onClicked: brightnessOnClick.running = true
                            }

                            Process {
                                id: brightnessOnClick
                                command: ["rofi-bluetooth", "-theme", ".config/rofi/launcher-style.rasi"]
                            }
                        }

                        Text { text: " " }

                        Item {
                            height: parent.height
                            width: parent.height

                            Image {
                                source: "./battery.svg"
                                height: parent.height - 5
                                width: parent.height - 5
                                anchors.centerIn: parent
                            }

                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor 
                                onClicked: batteryOnClick.running = true
                            }

                            Process {
                                id: batteryOnClick
                                command: ["rofi-bluetooth", "-theme", ".config/rofi/launcher-style.rasi"]
                            }
                        }
                    }
                }
            }
        }
    }
}