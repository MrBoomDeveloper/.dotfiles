import type { YouTubeClient } from "./model/youtubeClient";
import type { YouTubeApi } from "./youtubeApi";

export function getYouTubeHeaders(
    api: YouTubeApi,
    client: YouTubeClient,
    setLogin: boolean = false
): Record<string, string> {
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Format-Version": "1",
        "X-YouTube-Client-Name": client.clientId,
        "X-YouTube-Client-Version": client.clientVersion,
        "X-Origin": "https://music.youtube.com",
        "Referer": "https://music.youtube.com/",
        ...(setLogin && client.loginSupported && api.cookies != null ? {
            "cookie": api.cookies
        } : {})
        /**
        if (setLogin && client.loginSupported) {
            cookie?.let { cookie ->
                append("cookie", cookie)
                if ("SAPISID" !in cookieMap) return@let
                val currentTime = System.currentTimeMillis() / 1000
                val sapisidHash = sha1("$currentTime ${cookieMap["SAPISID"]} ${YouTubeClient.ORIGIN_YOUTUBE_MUSIC}")
                append("Authorization", "SAPISIDHASH ${currentTime}_${sapisidHash}")
            }
        }
    }
    userAgent(client.userAgent)
         */
    }
}