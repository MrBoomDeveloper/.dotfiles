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

    return await (await fetch("https://music.youtube.com/youtubei/v1/browse?prettyPrint=true", {
        "method": "POST",
        "headers": {
          "authorization": "SAPISIDHASH 1762749426_7dab3939dff90e85c6d2e0e00f91b9ff98c2b7f9_u SAPISID1PHASH 1762749426_7dab3939dff90e85c6d2e0e00f91b9ff98c2b7f9_u SAPISID3PHASH 1762749426_7dab3939dff90e85c6d2e0e00f91b9ff98c2b7f9_u",
          "content-type": "application/json",
          "cookie": "YSC=xR2qdRo3xYQ; __Secure-3PAPISID=ePvewS8Xn2k4-gRd/AYUHOXj7gNoUhIjN9; __Secure-3PSID=g.a0002ggbqXcXXN5H0FxcQVZYnJyaXbYid5cPL-CdQCK-GCSCQq4bWQsrsYSehIsXB88LPQ-01gACgYKAXoSARcSFQHGX2MivP6sOcqdDG_wVJ_S9xssshoVAUF8yKo0LRiFs6lE7bjamNNxt-o60076; LOGIN_INFO=AFmmF2swRgIhAPE0qGB9nmK-gfJEXN5UjiBTB-ptLZVGFcBnLhvWWhuMAiEA8vxm4RiWMuQ1Ye2yWQ9fjiaNO_LhBErObgadYBv3PFs:QUQ3MjNmeHdKRDRxV29vU0FLV0xOQlFyMkJtZERiX19zOW1qMk9Hd2Y4RFV6Y1AyUG1sS19SUDlleXU0YVNxMlJZX3U4VXdfWWllTXkxSjJoSElwemthZS1MS3h1LVJnUFpXNWRHQXhLMmZ6VlQ3Q1R4MGhsQnNUWXN0dTB0VTBGclU5ZHZkZFB1aTVzN0phWGhFWFJUS2ZlNnVpVlhlbVpB; HSID=ArynXaCm4M3tsJJq2; SSID=AQfQb1iymBwB2gM2V; APISID=dcvuGf2m698x86HQ/Ao2heYvWd3Z0J4qpR; SAPISID=ePvewS8Xn2k4-gRd/AYUHOXj7gNoUhIjN9; __Secure-1PAPISID=ePvewS8Xn2k4-gRd/AYUHOXj7gNoUhIjN9; SID=g.a0002ggbqXcXXN5H0FxcQVZYnJyaXbYid5cPL-CdQCK-GCSCQq4bwX8Pw6X9MZXEnKVTgLejpAACgYKAZsSARcSFQHGX2MiJgH2TEoBq0ygTCz0h-7t5RoVAUF8yKoH_Q3dNFCGpX7KC4Q_nAAq0076; __Secure-1PSID=g.a0002ggbqXcXXN5H0FxcQVZYnJyaXbYid5cPL-CdQCK-GCSCQq4b-rKMLcVF-mccZV3TGbuNawACgYKAW8SARcSFQHGX2MiFwH9EKVdC5mci6L4pcs67hoVAUF8yKpSdcS9hJ3ygDyAZmIoyi-10076; wide=1; PREF=tz=Etc.GMT%2B5&f5=30000&f7=100&repeat=NONE&gl=US&f6=400; VISITOR_PRIVACY_METADATA=CgJMVhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiBH; __Secure-1PSIDTS=sidts-CjUBwQ9iI_GwrzgD2PHOE0XPHai2U7IIYiqkQhBeEXCHyHQW6I_dTkyPF7G-Rb8er9kRPY7aHBAA; __Secure-3PSIDTS=sidts-CjUBwQ9iI_GwrzgD2PHOE0XPHai2U7IIYiqkQhBeEXCHyHQW6I_dTkyPF7G-Rb8er9kRPY7aHBAA; __Secure-ROLLOUT_TOKEN=CPmi7NvKivD6hgEQhJ_n4qi4kAMY88XR4ZfmkAM%3D; __Secure-YEC=CgtacUhhR084ZnpkWSi6nsXIBjInCgJMVhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiBH; SIDCC=AKEyXzWd_Uspbd7M9YexmVeuyOB-rDvgJlBKG2GLTfzlDGkDiJcoMY3Va7gNp4igsjgf0LdjoA; __Secure-1PSIDCC=AKEyXzXzA2txswixCDLyIF5pMA-yhktWGOL_TyOksBNS_3Z6eFusAjkZhGcBF8cgtjxtH-o0dA; __Secure-3PSIDCC=AKEyXzWaSBY0xAw1RyO2x1hLea1Yve6njeRR8fdKh2mwyr16IeSpcPp0Ky1NqMY2tj_0Xv8KGcs"
        },

        "body": "{\"context\":{\"client\":{\"hl\":\"en\",\"gl\":\"US\",\"remoteHost\":\"152.53.145.111\",\"deviceMake\":\"\",\"deviceModel\":\"\",\"visitorData\":\"CgtacUhhR084ZnpkWSjMvcTIBjInCgJMVhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiBH\",\"userAgent\":\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36,gzip(gfe)\",\"clientName\":\"WEB_REMIX\",\"clientVersion\":\"1.20251103.03.00\",\"osName\":\"X11\",\"osVersion\":\"\",\"originalUrl\":\"https://music.youtube.com/\",\"platform\":\"DESKTOP\",\"clientFormFactor\":\"UNKNOWN_FORM_FACTOR\",\"configInfo\":{\"appInstallData\":\"CMy9xMgGENeW0BwQndCwBRC72c4cEJTyzxwQudnOHBC1l9AcEIiHsAUQtbWAExCM6c8cENHgzxwQrbWAExD1l9AcEPOQ0BwQlffPHBCHrM4cEOK4zxwQzOvPHBCBzc4cEL2ZsAUQzN-uBRCln9AcEPyyzhwQyfevBRCZjbEFEL6KsAUQ3rzOHBCClNAcEJOD0BwQoKfQHBDlsoATEJT-sAUQltvPHBDyndAcEPv_zxwQwY_QHBDwnc8cELjkzhwQibDOHBDiuLAFEKil0BwQi_fPHBDI988cEJv2zxwQ-dDPHBCDntAcEK7WzxwQ9quwBRC9tq4FENr3zhwQndfPHBCuotAcEPOzgBMQ0-GvBRC36v4SEN7pzxwQ9pTQHBCoptAcEOyM0BwqRENBTVNMUlV1LVpxLURMaVVFdmNCdTlYd0N6S19YLW5WQlFQTl93V2hnQWFpTHFSaW41QUc5Z192TU16cDRoNGRCdz09MAA%3D\",\"coldConfigData\":\"CMy9xMgGGjJBT2pGb3gwbF9tS3M1YVN2bGRaRXVmekV3WDVfUDRnTW5jUkR2amJnTEhnUy10Z1lkZyIyQU9qRm94MW9EVXYzY1Q1VkVfbzJXNXZTWnlwNE1WdmRlLVQ4NXFYRXlUY3BTZWpyclE%3D\",\"coldHashData\":\"CMy9xMgGEhM4MzcyMjg4Nzg1MDY2MDg0NzkyGMy9xMgGMjJBT2pGb3gwbF9tS3M1YVN2bGRaRXVmekV3WDVfUDRnTW5jUkR2amJnTEhnUy10Z1lkZzoyQU9qRm94MW9EVXYzY1Q1VkVfbzJXNXZTWnlwNE1WdmRlLVQ4NXFYRXlUY3BTZWpyclE%3D\",\"hotHashData\":\"CMy9xMgGEhMyOTA0NDUyNDMyNjYxODQzODY3GMy9xMgGMjJBT2pGb3gwbF9tS3M1YVN2bGRaRXVmekV3WDVfUDRnTW5jUkR2amJnTEhnUy10Z1lkZzoyQU9qRm94MW9EVXYzY1Q1VkVfbzJXNXZTWnlwNE1WdmRlLVQ4NXFYRXlUY3BTZWpyclE%3D\"},\"userInterfaceTheme\":\"USER_INTERFACE_THEME_DARK\",\"timeZone\":\"Etc/GMT-5\",\"browserName\":\"Chrome\",\"browserVersion\":\"140.0.0.0\",\"acceptHeader\":\"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7\",\"deviceExperimentId\":\"ChxOelUzTURnMk5qTXhNRGd5T0RFM056UTNOdz09EMy9xMgGGMy9xMgG\",\"rolloutToken\":\"CPmi7NvKivD6hgEQhJ_n4qi4kAMY88XR4ZfmkAM%3D\",\"screenWidthPoints\":477,\"screenHeightPoints\":996,\"screenPixelDensity\":1,\"screenDensityFloat\":1,\"utcOffsetMinutes\":300,\"musicAppInfo\":{\"pwaInstallabilityStatus\":\"PWA_INSTALLABILITY_STATUS_CAN_BE_INSTALLED\",\"webDisplayMode\":\"WEB_DISPLAY_MODE_BROWSER\",\"storeDigitalGoodsApiSupportStatus\":{\"playStoreDigitalGoodsApiSupportStatus\":\"DIGITAL_GOODS_API_SUPPORT_STATUS_UNSUPPORTED\"}}},\"user\":{\"lockedSafetyMode\":false},\"request\":{\"useSsl\":true,\"internalExperimentFlags\":[],\"consistencyTokenJars\":[],\"innertubeTokenJar\":{\"appTokens\":[{\"type\":1,\"value\":\"CjIKC0NnWUlnZU94NkF3EiNRUE9LRUpLbDExemNoOG4ybEdyWnFCX3lQY3ZjNzVfMWs0Mg==\",\"maxAgeSeconds\":86400,\"creationTimeUsec\":\"1762749201738874\"},{\"type\":2,\"value\":\"EicKI1FQT0tFSktsMTF6Y2g4bjJsR3JacUJfeVBjdmM3NV8xazQyEAA=\",\"maxAgeSeconds\":86400,\"creationTimeUsec\":\"1762729686639776\"}]}},\"clickTracking\":{\"clickTrackingParams\":\"CAkQpoULGAEiEwj35JeRz-aQAxVdknwGHXA-KRDKAQSWXW6E\"},\"adSignalsInfo\":{\"params\":[{\"key\":\"dt\",\"value\":\"1762729676817\"},{\"key\":\"flash\",\"value\":\"0\"},{\"key\":\"frm\",\"value\":\"0\"},{\"key\":\"u_tz\",\"value\":\"300\"},{\"key\":\"u_his\",\"value\":\"10\"},{\"key\":\"u_h\",\"value\":\"1080\"},{\"key\":\"u_w\",\"value\":\"1920\"},{\"key\":\"u_ah\",\"value\":\"1080\"},{\"key\":\"u_aw\",\"value\":\"1920\"},{\"key\":\"u_cd\",\"value\":\"24\"},{\"key\":\"bc\",\"value\":\"31\"},{\"key\":\"bih\",\"value\":\"996\"},{\"key\":\"biw\",\"value\":\"462\"},{\"key\":\"brdim\",\"value\":\"0,0,0,0,1920,0,1910,1043,477,996\"},{\"key\":\"vis\",\"value\":\"1\"},{\"key\":\"wgl\",\"value\":\"true\"},{\"key\":\"ca_type\",\"value\":\"image\"}]},\"activePlayers\":[{\"playerContextParams\":\"Q0FFU0FnZ0I=\"}]},\"browseId\":\"VLPLSWY81108wBhKajj1EUuBr89ydg-DUjPy\"}",
      })).json();

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