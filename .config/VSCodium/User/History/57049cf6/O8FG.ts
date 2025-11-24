import type { YouTubeClient } from "./model/youtubeClient";
import type { YouTubeApi } from "./youtubeApi";

export async function browse(
    api: YouTubeApi,
    client: YouTubeClient,
    browseId: string | null = null,
    params: string | null = null,
    continuation: string | null = null,
    setLogin: boolean = false
) {
    return await (await fetch("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false", {
        method: "POST",

        headers: {
          "content-type": "application/json",
          "cookie": api.cookies
        },

        body: JSON.stringify({
            browseId: browseId,
            context: {
                client: {
                    hl: api.locale.hl,
                    gl: api.locale.gl,
                    visitorData: api.visitorData,
                    clientName: client.clientName,
                    clientVersion: client.clientVersion,
                    osName: client.osName,
                    osVersion: client.osVersion
                }
            }
        })
    })).json();
}