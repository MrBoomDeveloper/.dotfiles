import { $ } from "bun";
import { browse } from "./innertube";
import { YouTubeClients } from "./model/youtubeClient";

export async function browsePlaylist(
    playlistId: string
) {
    const response = await browse(
        YouTubeClients.WEB_REMIX,
        `VL${playlistId}`,
        null,
        null,
        true
    )

    async function error(text: string) {
        await $`echo ${text} | rofi -e`;
      }

    await error(JSON.stringify(response))
    process.exit(1)
}