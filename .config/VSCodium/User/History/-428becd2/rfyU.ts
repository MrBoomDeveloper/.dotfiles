import { browse } from "./innertube";
import { YouTubeClient, YouTubeClients } from "./model/youtubeexport async function browsePlaylist(
    playlistId: string
) {
    const response = await browse(
        YouTubeClients.WEB_REMIX,
        `VL${playlistId}`,
        null,
        null,
        true
    )

    throw JSON.stringify(response)
}