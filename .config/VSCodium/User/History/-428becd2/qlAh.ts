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
    )

    return {
        name: "Unknown name",
        songs: []
    }
}

export interface Playlist {
    name: string,
    songs: Song[]
}

export interface Song {
    name: string
}