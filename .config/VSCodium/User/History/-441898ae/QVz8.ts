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
        
        console.log(jsons);
    
        return {
            conversationId: jsons.find(it => "conversation" in it).conversation.conversationId,

            responseMessage: jsons.find(it => "modelResponse" in it)?.modelResponse?.message ??
                jsons.find(it => "response" in it && "modelResponse" in it.response).response.modelResponse.message
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
                "disableSelfHarmShortCircuit":true
            }),
            
            "headers": {
              "x-statsig-id": this.xStatsigId,
              "cookie": this.cookie
            }
          })).text();

        console.log(response);
    
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