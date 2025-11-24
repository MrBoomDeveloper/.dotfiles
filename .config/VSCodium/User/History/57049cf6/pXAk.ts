import type { YouTubeClient } from "./model/youtubeClient";

export async function browse(
    client: YouTubeClient,
    browseId: string | null = null,
    params: string | null = null,
    continuation: string | null = null,
    setLogin: boolean = false
) {
    /**
     * ytClient(client, setLogin = setLogin || useLoginForBrowse)
    setBody(
        BrowseBody(
            context = client.toContext(
                locale,
                visitorData,
                if (setLogin || useLoginForBrowse) dataSyncId else null
            ),
            browseId = browseId,
            params = params,
            continuation = continuation
        )
    )
     */
    return await (await fetch("https://music.youtube.com/youtubei/v1/browse", {
        method: "POST",
        
        headers: {
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
        },

        body: JSON.stringify({
            
        })
    })).json();
}