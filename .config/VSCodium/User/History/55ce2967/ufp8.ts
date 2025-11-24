export function getYouTubeHeaders(): Record<string, string> {
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Format-Version": "1",
        "X-YouTube-Client-Name": client.clientId,
        "X-YouTube-Client-Version": client.clientVersion,
        "X-Origin": "https://music.youtube.com",
        "Referer": "https://music.youtube.com/"
        /**
         * append("", "1")
        append("", client.clientId)
        append("", client.clientVersion)
        append("", YouTubeClient.ORIGIN_YOUTUBE_MUSIC)
        append("", YouTubeClient.REFERER_YOUTUBE_MUSIC)
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