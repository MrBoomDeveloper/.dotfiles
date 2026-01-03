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
          "accept": "*/*",
          "content-type": "application/json",
          "priority": "u=1, i",
          "sentry-trace": "1b698077706cb869cac05343d476a0dd-8e04b249fb04e585-0",
          "traceparent": "00-b53c8646f2e66ef63d3889d07be6206b-cd19ed2e5a39a948-00",
          "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=CLaCn5PvTdQeN_buQy5sH1wpcGxvNzYZnRcc_DUKl1k-1767088795-1.2.1.1-xVSu0k.mO9wzCgdEvI.psQE1wK68DV2Y3lNjIUWbGk5HHzKGH8EXOLiH5dnU9WEBkZDqEfqeH_BUgBGQ1.8qyynpUYIRJSlXIPXyA1pmV9sqVCJmjeHf6mZUcRKRpBwYfhgrTtCgfvZ0PZwMGRFils.3igN3OUA_hxk4zYDRKY2DqTrUPdD9_2fG_zA4NuAJ_up.YrIEWBR2rZ6GKI10KYHVEVCOTVJ76j0IFKbknqk; _ga_8FEWB057YH=GS2.1.s1767087954$o16$g1$t1767088796$j59$l0$h0",
          "Referer": "https://grok.com/"
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