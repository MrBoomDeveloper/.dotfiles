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
            "collectionIds":[],
            
            "deviceEnvInfo":{
                "darkModeEnabled":true,
                "devicePixelRatio":1,
                "screenWidth":1920,
                "screenHeight":1080,
                "viewportWidth":791,
                "viewportHeight":996
            }
        }),

        headers: {
          "accept": "*/*",
          "accept-language": "ru,en-US;q=0.9,en;q=0.8",
          "baggage": "sentry-environment=production,sentry-release=09998486040afdfe64e07f183a12bb74b07e6a1b,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=1b698077706cb869cac05343d476a0dd,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.28343753061494925,sentry-sample_rate=0",
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
          "sentry-trace": "1b698077706cb869cac05343d476a0dd-8e04b249fb04e585-0",
          "traceparent": "00-b53c8646f2e66ef63d3889d07be6206b-cd19ed2e5a39a948-00",
          "x-statsig-id": "fwvZZVDCBYL0TILSexxfSR5JrpWvwA6/smlOJObSD382GXlVGJGtkjAgcpYd8jjrI7RAe3qa4Ka/3B/w4MCoqgtK+fa5fA",
          "x-xai-request-id": "3b3ec8d7-307c-4094-9d05-3cc406644c00",
          "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=CLaCn5PvTdQeN_buQy5sH1wpcGxvNzYZnRcc_DUKl1k-1767088795-1.2.1.1-xVSu0k.mO9wzCgdEvI.psQE1wK68DV2Y3lNjIUWbGk5HHzKGH8EXOLiH5dnU9WEBkZDqEfqeH_BUgBGQ1.8qyynpUYIRJSlXIPXyA1pmV9sqVCJmjeHf6mZUcRKRpBwYfhgrTtCgfvZ0PZwMGRFils.3igN3OUA_hxk4zYDRKY2DqTrUPdD9_2fG_zA4NuAJ_up.YrIEWBR2rZ6GKI10KYHVEVCOTVJ76j0IFKbknqk; _ga_8FEWB057YH=GS2.1.s1767087954$o16$g1$t1767088796$j59$l0$h0",
          "Referer": "https://grok.com/"
        }
    })).text();

    const jsons = response.split("\n")
        .filter(it => it.trim() != "")
        .map(it => JSON.parse(it).result);

    return {
        conversationId: jsons.find(it => "conversation" in it).conversation.conversationId,
        responseMessage: jsons.find(it => "modelResponse" in it.response).response.modelResponse.message
    }
}