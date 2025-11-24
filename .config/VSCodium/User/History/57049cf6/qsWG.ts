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
        
        headers: ,

        body: JSON.stringify({
            
        })
    })).json();
}