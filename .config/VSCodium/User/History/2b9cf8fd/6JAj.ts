export interface NewConversationRequest {
    modelName: string,
    modelMode: string,
    initialMessage: string,
    temporary: boolean,
    enableSearch: boolean,
    enableMemory: boolean,
    isReasoning: boolean,
    images: NewConversationImageParams
}

export interface NewConversationImageParams {
    enableImageGeneration: boolean,
    enableImageStreaming: boolean
}

export interface NewConversationResponse {
    conversationId: string,
    responseMessage: string
}

export async function newConversation(params: NewConversationRequest): Promise<NewConversationResponse> {
    const response = await (await fetch("https://grok.com/rest/app-chat/conversations/new", {
        method: "POST",

        body: JSON.stringify({
            temporary: params.temporary,
            modelName: params.modelName,
            modelMode: params.modelMode,
            message: params.initialMessage,
            "fileAttachments": [],
            "imageAttachments": [],
            disableSearch: !params.enableSearch,
            enableImageGeneration: params.images.enableImageGeneration,
            "returnImageBytes":false,
            "returnRawGrokInXaiRequest":false,
            enableImageStreaming: params.images.enableImageStreaming,
            "imageGenerationCount":2,
            "forceConcise":false,
            "toolOverrides":{},
            "enableSideBySide":true,
            "sendFinalMetadata":true,
            isReasoning: params.isReasoning,
            "disableTextFollowUps":false,

            "responseMetadata":{
                "modelConfigOverride":{
                    "modelMap":{}
                },
                
                "requestModelDetails":{
                    "modelId":"grok-3"
                }
            },
            
            disableMemory: !params.enableMemory,
            "forceSideBySide":false,
            "isAsyncChat":false,
            "disableSelfHarmShortCircuit": true,
            "collectionIds":[]
        }),

        headers: {
          "x-statsig-id": "fwvZZVDCBYL0TILSexxfSR5JrpWvwA6/smlOJObSD382GXlVGJGtkjAgcpYd8jjrI7RAe3qa4Ka/3B/w4MCoqgtK+fa5fA",
          "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=CLaCn5PvTdQeN_buQy5sH1wpcGxvNzYZnRcc_DUKl1k-1767088795-1.2.1.1-xVSu0k.mO9wzCgdEvI.psQE1wK68DV2Y3lNjIUWbGk5HHzKGH8EXOLiH5dnU9WEBkZDqEfqeH_BUgBGQ1.8qyynpUYIRJSlXIPXyA1pmV9sqVCJmjeHf6mZUcRKRpBwYfhgrTtCgfvZ0PZwMGRFils.3igN3OUA_hxk4zYDRKY2DqTrUPdD9_2fG_zA4NuAJ_up.YrIEWBR2rZ6GKI10KYHVEVCOTVJ76j0IFKbknqk; _ga_8FEWB057YH=GS2.1.s1767087954$o16$g1$t1767088796$j59$l0$h0"
        }
    })).text();

    const jsons = response.split("\n")
        .filter(it => it.trim() != "")
        .map(it => JSON.parse(it).result);

    return {
        conversationId: jsons.find(it => "conversation" in it).conversation.conversationId,
        responseMessage: jsons.find(it => "response" in it && "modelResponse" in it.response).response.modelResponse.message
    }
}

export async function getRateLimits() {
    const response = (await fetch("https://grok.com/rest/rate-limits", {
        body: "{\"requestKind\":\"DEFAULT\",\"modelName\":\"grok-3\"}",
        method: "POST",
        
        "headers": {
          "accept": "*/*",
          "accept-language": "ru,en-US;q=0.9,en;q=0.8",
          "baggage": "sentry-environment=production,sentry-release=09998486040afdfe64e07f183a12bb74b07e6a1b,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=8a87e28c255a000e13538f79f81ee59c,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.25279756448122837,sentry-sample_rate=0",
          "content-type": "application/json",
          "priority": "u=1, i",
          "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
          "sec-ch-ua-arch": "\"x86\"",
          "sec-ch-ua-bitness": "\"64\"",
          "sec-ch-ua-full-version": "\"142.0.7444.245\"",
          "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-model": "\"\"",
          "sec-ch-ua-platform": "\"Linux\"",
          "sec-ch-ua-platform-version": "\"6.18.2\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "sentry-trace": "8a87e28c255a000e13538f79f81ee59c-9ab2e76a111e214e-0",
          "traceparent": "00-d4ad5814cde90cb8286cae4d46dd7f8a-3d7e4b7f6aa66d5a-00",
          "x-statsig-id": "z96h9XOVyWL9l2Cu0rOR9oluq4MIvSuEmE2x60B3Zw+v9vBpbO3s8rfnyxtYl0P1+7aYy8oHCInLBojqA+L2pQKTZ/tCzA",
          "x-xai-request-id": "0684c3b2-4dce-4582-8344-d33bc3df8ca4",
          "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=cOHGczsfK6Nl9_AnTbiOTcJgRCH_GzBl0rZwW7allJg-1767091366-1.2.1.1-OT0t2AsHIp7s9KFOdKkMOTaZx_UvrYMhTUT3JeK9uzs.Tqe4r.4dmXFVRPmYANXJHDYjDF3c.ovQ9vUbUVSX5QM0bGqvJbIBAI7nbCiI7gvNOWgO1nutKO.3hV6eecQtYr9xfqXw02evknaEJZd7RgxfwQ_B0yvqCm0mA0s7iA_Or4IWxrwaf8_PxwnjcEZP8.UCJx0M.1YFQXnfK2RetnJix1UnsWcglgcO1xT3e7U; _ga_8FEWB057YH=GS2.1.s1767094927$o18$g1$t1767095015$j60$l0$h0",
          "Referer": "https://grok.com/c/626da259-966a-449d-8ff4-e3ceb90213f9?rid=fc0d4efc-ce29-43f1-b7ea-4f55c5259e14"
        }
    })).json();
}