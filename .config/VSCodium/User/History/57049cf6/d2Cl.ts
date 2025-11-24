import type { YouTubeClient } from "./model/youtubeClient";
import type { YouTubeApi } from "./youtubeApi";
import { getYouTubeHeaders } from "./youtubeHeaders";

export async function browse(
    api: YouTubeApi,
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

    return );

    return await (await fetch("https://music.youtube.com/youtubei/v1/browse", {
        method: "POST",

        headers: getYouTubeHeaders(
            api,
            client,
            setLogin
        ),

        body: JSON.stringify({
            context: client.toContext(api),
            browseId,
            params,
            continuation
        })
    })).json();
}