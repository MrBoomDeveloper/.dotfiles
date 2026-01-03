import Quickshell
import Quickshell.Widgets
import QtQuick.Layouts
import Quickshell.Hyprland
import Quickshell.Services.UPower
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
                                source: getWifiIcon(Wifi.signalLevel)
                                height: parent.height - 8
                                width: parent.height - 8
                                anchors.centerIn: parent

                                function getWifiIcon(power) {
                                    switch(power) {
                                        case 0: return "ic_wifi_off.svg";
                                        case 1: return "ic_wifi_1.svg";
                                        case 2: return "ic_wifi_2.svg";
                                        case 3: return "ic_wifi_3.svg";
                                        case 4: return "ic_wifi_4.svg";
                                        default: return "ic_wifi_off.svg";
                                    }
                                }
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
                        }

                        Item {
                            height: parent.height
                            width: parent.height

                            Image {
                                source: "./bluetooth.svg"
                                height: parent.height - 8
                                width: parent.height - 8
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
                                height: parent.height - 7
                                width: parent.height - 7
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
                                height: parent.height - 10
                                width: parent.height - 10
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

                        Item {
                            height: parent.height
                            width: parent.height
                            visible: UPower.isLaptopBattery

                            Image {
                                source: getBatteryIcon(UPowerDevice.state == UPowerDeviceState.Charging, UPower.percentage)
                                height: parent.height - 6
                                width: parent.height - 6
                                anchors.centerIn: parent

                                function getBatteryIcon(isCharging, percentage) {
                                    if(isCharging) return "ic_battery_charging.svg"
                                    if(percentage < 100) return "ic_battery_1.svg"
                                    console.log("some text" + percentage)
                                    return "ic_battery.svg"
                                }
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