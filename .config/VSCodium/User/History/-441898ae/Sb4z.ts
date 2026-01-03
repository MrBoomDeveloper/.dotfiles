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

    async continueConversation(params: ContinueConversationParams): Promise<ContinueConversationResponse> {
        const response = await (await fetch(`https://grok.com/rest/app-chat/conversations/${params.conversationId}/responses`, {
            method: "POST",

            body: JSON.stringify({
                "message": params.message,
                "modelName":"grok-4-1-thinking-1129",
                /*"parentResponseId":"a171c338-0b05-44a5-8ee5-ec071e4980d6"*/
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
                        "modelId":"grok-4-1-thinking-1129"
                    },
                    
                    "request_metadata":{
                        "model":"grok-4-1-thinking-1129",
                        "mode":"grok-4-1"
                    }
                },
                    
                "disableTextFollowUps":false,
                "disableArtifact":false,
                "isFromGrokFiles":false,
                "disableMemory": !params.enableMemory,
                "forceSideBySide":false,
                "modelMode":"MODEL_MODE_GROK_4_1",
                "isAsyncChat":false,
                "skipCancelCurrentInflightRequests":false,
                "isRegenRequest":false,
                "disableSelfHarmShortCircuit":true,

                "deviceEnvInfo":{
                    "darkModeEnabled":true,
                    "devicePixelRatio":1,
                    "screenWidth":1920,
                    "screenHeight":1080,
                    "viewportWidth":754,
                    "viewportHeight":996
                }
            }),
            
            "headers": {
              "accept": "*/*",
              "accept-language": "ru,en-US;q=0.9,en;q=0.8",
              "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=ac1791b1ff01496fd2dbe90308dc2e4a,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.37236386785769504,sentry-sample_rate=0",
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
              "sentry-trace": "ac1791b1ff01496fd2dbe90308dc2e4a-96c9da5e5738d8c2-0",
              "traceparent": "00-9c1028c84798543033d18968d2abaaa3-d30bbfe4270d446e-00",
              "x-statsig-id": this.xStatsigId,
              "x-xai-request-id": "1378c542-dfc8-4f92-b7a2-b4953c3df5fc",
              "cookie": this.cookie
            }
          })).text();
    
        const jsons = response.split("\n")
            .filter(it => it.trim() != "")
            .map(it => JSON.parse(it).result);
    
        return {
            responseMessage: jsons.find(it => "modelResponse" in it)?.modelResponse?.message ??
                jsons.find(it => "response" in it && "modelResponse" in it.response).response.modelResponse.message
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