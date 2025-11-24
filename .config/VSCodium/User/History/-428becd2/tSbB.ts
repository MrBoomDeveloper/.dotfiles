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

    console.log(JSON.stringify(response))
    process.exit(0)
}