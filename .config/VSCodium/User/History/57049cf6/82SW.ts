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
            "context": {
              "client": {
                "hl": api.locale.hl,
                "gl": api.locale.gl,
                "visitorData": "CgtacUhhR084ZnpkWSjMvcTIBjInCgJMVhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiBH",
                "clientName": client.clientName,
                "clientVersion": client.clientVersion,
                "osName": client.osName,
                "osVersion": client.osVersion,
                "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "deviceExperimentId": "ChxOelUzTURnMk5qTXhNRGd5T0RFM056UTNOdz09EMy9xMgGGMy9xMgG",
                "rolloutToken": "CPmi7NvKivD6hgEQhJ_n4qi4kAMY88XR4ZfmkAM%3D",
                "musicAppInfo": {
                  "pwaInstallabilityStatus": "PWA_INSTALLABILITY_STATUS_CAN_BE_INSTALLED",
                  "webDisplayMode": "WEB_DISPLAY_MODE_BROWSER",
                  "storeDigitalGoodsApiSupportStatus": {
                    "playStoreDigitalGoodsApiSupportStatus": "DIGITAL_GOODS_API_SUPPORT_STATUS_UNSUPPORTED"
                  }
                }
              },
              "user": {
                "lockedSafetyMode": false
              },
              "request": {
                "useSsl": true,
                "internalExperimentFlags": [],
                "consistencyTokenJars": [],
                "innertubeTokenJar": {
                  "appTokens": [
                    {
                      "type": 1,
                      "value": "CjIKC0NnWUlnZU94NkF3EiNRUE9LRUpLbDExemNoOG4ybEdyWnFCX3lQY3ZjNzVfMWs0Mg==",
                      "maxAgeSeconds": 86400,
                      "creationTimeUsec": "1762742093066325"
                    },
                    {
                      "type": 2,
                      "value": "EicKI1FQT0tFSktsMTF6Y2g4bjJsR3JacUJfeVBjdmM3NV8xazQyEAA=",
                      "maxAgeSeconds": 86400,
                      "creationTimeUsec": "1762729686639776"
                    }
                  ]
                }
              }
            },

            "browseId": browseId
          })
    })).json();

    // return await (await fetch("https://music.youtube.com/youtubei/v1/browse", {
    //     method: "POST",

    //     headers: getYouTubeHeaders(
    //         api,
    //         client,
    //         setLogin
    //     ),

    //     body: JSON.stringify({
    //         context: client.toContext(api),
    //         browseId,
    //         params,
    //         continuation
    //     })
    // })).json();
}