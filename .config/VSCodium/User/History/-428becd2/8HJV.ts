import { $ } from "bun";
import { browse } from "./innertube";
import { YouTubeClients } from "./model/youtubeClient";
import type { YouTubeApi } from "./youtubeApi";

export async function browsePlaylist(
    api: YouTubeApi,
    playlistId: string
): Promise<Playlist> {
    const response = await browse(
        api,
        YouTubeClients.WEB_REMIX,
        `VL${playlistId}`,
        null,
        null,
        true
    ) as any

    return {
        id: "unknown_id",
        name: "Unknown name",
        songs: response.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicPlaylistShelfRenderer.contents.map((song: any) => {
            return {
                videoId: "id",
                name: song.musicResponsiveListItemRenderer.overlay.flexColumns
            }
        })
    }
}

export interface Playlist {
    id: string,
    name: string,
    songs: Song[]
}

export interface Song {
    name: string,
    videoId: string
}