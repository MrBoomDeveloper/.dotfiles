#!/usr/bin/env bash

# Options
emojiPicker="Emoji Picker"
iconPicker='Icon Picker'
manageNetwork='Manage Network'
manageBluetooth='Manage Bluetooth'
power='Power Options'

launchRofi() {
	echo -e "$emojiPicker\0icon\x1f<span>🫠</span>\n$iconPicker\0icon\x1f<span>✨</span>\n$manageNetwork\0icon\x1f<span>🌐</span>\n$manageBluetooth\0icon\x1f<span>🎧</span>\n$power\0icon\x1f<span>✌️</span>" | \
		rofi \
			-dmenu \
			-format s \
			-theme launcher-style.rasi
}

case $(launchRofi) in
	$emojiPicker)
		rofimoji \
			--action copy \
			--hidden-descriptions \
			--use-icons \
			--selector-args "-theme $HOME/.config/rofi/emoji-style.rasi"
	;;

	$iconPicker)
		rofimoji \
                        --action copy \
                        --hidden-descriptions \
                        --use-icons \
			-f fontawesome6 \
                        --selector-args "-theme $HOME/.config/rofi/emoji-style.rasi"
	;;

	$manageNetwork)
		ronema
	;;

	$manageBluetooth)
		rofi-bluetooth \
			-theme $HOME/.config/rofi/launcher-style.rasi
	;;

	$power)
		~/.config/rofi/powermenu.sh
	;;
esac
