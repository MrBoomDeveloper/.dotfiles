import { parseJson } from "../utils/base_utils";

export interface ConversationParams {
    modelName: string,
    modelMode: string,
    message: string,
    temporary: boolean,
    enableSearch: boolean,
    enableMemory: boolean,
    isReasoning: boolean,
    images: ConversationImageParams
}

export type ContinueConversationParams = ConversationParams & {
    conversationId: string
}

export interface ContinueConversationResponse {
    responseMessage: string
}

export interface ConversationImageParams {
    enableImageGeneration: boolean,
    enableImageStreaming: boolean
}

export interface ConversationResponse {
    conversationId: string,
    responseMessage: string
}

export interface GrokParams {
    cookie: string,
    xStatsigId: string
}

export interface RateLimits {
    windowSizeSeconds: number,
    remainingTokens: number,
    totalTokens: number
}

export class Grok {
    private cookie: string
    private xStatsigId: string

    constructor(params: GrokParams) {
        this.cookie = params.cookie;
        this.xStatsigId = params.xStatsigId;
    }

    async newConversation(params: ConversationParams): Promise<ConversationResponse> {
        const response = await (await fetch("https://grok.com/rest/app-chat/conversations/new", {
            method: "POST",
    
            body: JSON.stringify({
                temporary: params.temporary,
                modelName: params.modelName,
                modelMode: params.modelMode,
                message: params.message,
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
                        "modelId": params.modelName
                    }
                },
                
                disableMemory: !params.enableMemory,
                "forceSideBySide":false,
                "isAsyncChat":false,
                "disableSelfHarmShortCircuit": true,
                "collectionIds":[]
            }),
    
            headers: {
                "x-statsig-id": this.xStatsigId,
                "cookie": this.cookie
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

    async continueConversation(params: ContinueConversationParams): ContinueConversationResponse {
        const response = await (await fetch(`https://grok.com/rest/app-chat/conversations/${params.conversationId}/responses`, {
            method: "POST",

            body: JSON.stringify({
                "message": params.message,
                "modelName": params.modelName,
                // "parentResponseId":"4c00e730-891e-47d5-8f11-fd8fd96fcb36",
                "disableSearch": !params.enableSearch,
                "enableImageGeneration": params.images.enableImageGeneration,
                "imageAttachments":[],
                "returnImageBytes":false,
                "returnRawGrokInXaiRequest":false,
                "fileAttachments":[],
                "enableImageStreaming": params.images.enableImageStreaming,
                "imageGenerationCount":2,
                "forceConcise":false,
                "toolOverrides":{},
                "enableSideBySide":true,
                "sendFinalMetadata":true,
                "isReasoning": params.isReasoning,

                "metadata":{
                    "modelConfigOverride":{
                        "modelMap":{}
                    },
                    
                    "requestModelDetails":{
                        "modelId": params.modelName
                    },
                    
                    "request_metadata":{
                        "model": params.modelName,
                        "mode": params.modelMode
                    }
                },
                
                "disableTextFollowUps":false,
                "disableArtifact":false,
                "isFromGrokFiles":false,
                "disableMemory": !params.enableMemory,
                "forceSideBySide":false,
                "modelMode": params.modelMode,
                "isAsyncChat":false,
                "skipCancelCurrentInflightRequests":false,
                "isRegenRequest":false,
                "disableSelfHarmShortCircuit":true,
                
                // "deviceEnvInfo":{
                //     "darkModeEnabled":true,
                //     "devicePixelRatio":1,
                //     "screenWidth":1920,
                //     "screenHeight":1080,
                //     "viewportWidth":1031,
                //     "viewportHeight":996
                // }
            }),
            
            "headers": {
              "accept": "*/*",
              "accept-language": "ru,en-US;q=0.9,en;q=0.8",
              "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=45ebf7fd757dfd249ab10954708b193e,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.11275660568202639,sentry-sample_rate=0",
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
              "sentry-trace": "45ebf7fd757dfd249ab10954708b193e-bea1e9f85b2fa653-0",
              "traceparent": "00-b8fc4e51a684922613bdc917a9330fd3-5a4651f4c0788a91-00",
              "x-statsig-id": "5enwl0+jpcFPkb4owDoLZMKScPOzjDc1m5WhKzRW9f2eCjU+xn5o47Bdcjvmuk+zw3oB4eD+8QkFcMntXRp0LuGovi2g5g",
              "x-xai-request-id": "8fce262f-9ad8-4a77-bdbf-9982d4ce3619",
              "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767130942$j60$l0$h0",
              "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=4c00e730-891e-47d5-8f11-fd8fd96fcb36"
            }
        })).text();
    
        const jsons = response.split("\n")
            .filter(it => it.trim() != "")
            .map(it => JSON.parse(it).result);
    
        return {
            responseMessage: jsons.find(it => "response" in it && "modelResponse" in it.response).response.modelResponse.message
        }
    }
    
    async getRateLimits(): Promise<RateLimits> {
        const response = parseJson(await (await fetch("https://grok.com/rest/rate-limits", {
            body: "{\"requestKind\":\"DEFAULT\",\"modelName\":\"grok-3\"}",
            method: "POST",
            headers: {
                "x-statsig-id": this.xStatsigId,
                "cookie": this.cookie
            }
        })).text());
    
        return {
            windowSizeSeconds: response.windowSizeSeconds,
            totalTokens: response.totalTokens,
            remainingTokens: response.remainingTokens
        }
    }
}