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
                "hl": "en",
                "gl": "US",
                "visitorData": "CgtacUhhR084ZnpkWSjMvcTIBjInCgJMVhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiBH",
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20251103.03.00",
                "osName": "X11",
                "osVersion": "",
                "originalUrl": "https://music.youtube.com/",
                "platform": "DESKTOP",
                "clientFormFactor": "UNKNOWN_FORM_FACTOR",
                "configInfo": {
                  "appInstallData": "CMy9xMgGENeW0BwQndCwBRC72c4cEJTyzxwQudnOHBC1l9AcEIiHsAUQtbWAExCM6c8cENHgzxwQrbWAExD1l9AcEPOQ0BwQlffPHBCHrM4cEOK4zxwQzOvPHBCBzc4cEL2ZsAUQzN-uBRCln9AcEPyyzhwQyfevBRCZjbEFEL6KsAUQ3rzOHBCClNAcEJOD0BwQoKfQHBDlsoATEJT-sAUQltvPHBDyndAcEPv_zxwQwY_QHBDwnc8cELjkzhwQibDOHBDiuLAFEKil0BwQi_fPHBDI988cEJv2zxwQ-dDPHBCDntAcEK7WzxwQ9quwBRC9tq4FENr3zhwQndfPHBCuotAcEPOzgBMQ0-GvBRC36v4SEN7pzxwQ9pTQHBCoptAcEOyM0BwqRENBTVNMUlV1LVpxLURMaVVFdmNCdTlYd0N6S19YLW5WQlFQTl93V2hnQWFpTHFSaW41QUc5Z192TU16cDRoNGRCdz09MAA%3D",
                  "coldConfigData": "CMy9xMgGGjJBT2pGb3gwbF9tS3M1YVN2bGRaRXVmekV3WDVfUDRnTW5jUkR2amJnTEhnUy10Z1lkZyIyQU9qRm94MW9EVXYzY1Q1VkVfbzJXNXZTWnlwNE1WdmRlLVQ4NXFYRXlUY3BTZWpyclE%3D",
                  "coldHashData": "CMy9xMgGEhM4MzcyMjg4Nzg1MDY2MDg0NzkyGMy9xMgGMjJBT2pGb3gwbF9tS3M1YVN2bGRaRXVmekV3WDVfUDRnTW5jUkR2amJnTEhnUy10Z1lkZzoyQU9qRm94MW9EVXYzY1Q1VkVfbzJXNXZTWnlwNE1WdmRlLVQ4NXFYRXlUY3BTZWpyclE%3D",
                  "hotHashData": "CMy9xMgGEhMyOTA0NDUyNDMyNjYxODQzODY3GMy9xMgGMjJBT2pGb3gwbF9tS3M1YVN2bGRaRXVmekV3WDVfUDRnTW5jUkR2amJnTEhnUy10Z1lkZzoyQU9qRm94MW9EVXYzY1Q1VkVfbzJXNXZTWnlwNE1WdmRlLVQ4NXFYRXlUY3BTZWpyclE%3D"
                },
                "userInterfaceTheme": "USER_INTERFACE_THEME_DARK",
                "timeZone": "Etc/GMT-5",
                "browserName": "Chrome",
                "browserVersion": "140.0.0.0",
                "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "deviceExperimentId": "ChxOelUzTURnMk5qTXhNRGd5T0RFM056UTNOdz09EMy9xMgGGMy9xMgG",
                "rolloutToken": "CPmi7NvKivD6hgEQhJ_n4qi4kAMY88XR4ZfmkAM%3D",
                "screenWidthPoints": 557,
                "screenHeightPoints": 996,
                "screenPixelDensity": 1,
                "screenDensityFloat": 1,
                "utcOffsetMinutes": 300,
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
              },
              "adSignalsInfo": {
                "params": [
                  {
                    "key": "dt",
                    "value": "1762729676817"
                  },
                  {
                    "key": "flash",
                    "value": "0"
                  },
                  {
                    "key": "frm",
                    "value": "0"
                  },
                  {
                    "key": "u_tz",
                    "value": "300"
                  },
                  {
                    "key": "u_his",
                    "value": "8"
                  },
                  {
                    "key": "u_h",
                    "value": "1080"
                  },
                  {
                    "key": "u_w",
                    "value": "1920"
                  },
                  {
                    "key": "u_ah",
                    "value": "1080"
                  },
                  {
                    "key": "u_aw",
                    "value": "1920"
                  },
                  {
                    "key": "u_cd",
                    "value": "24"
                  },
                  {
                    "key": "bc",
                    "value": "31"
                  },
                  {
                    "key": "bih",
                    "value": "996"
                  },
                  {
                    "key": "biw",
                    "value": "542"
                  },
                  {
                    "key": "brdim",
                    "value": "0,0,0,0,1920,0,1910,1043,557,996"
                  },
                  {
                    "key": "vis",
                    "value": "1"
                  },
                  {
                    "key": "wgl",
                    "value": "true"
                  },
                  {
                    "key": "ca_type",
                    "value": "image"
                  }
                ]
              },
              "activePlayers": [
                {
                  "playerContextParams": "Q0FFU0FnZ0I="
                }
              ]
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