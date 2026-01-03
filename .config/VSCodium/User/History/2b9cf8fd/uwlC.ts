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

    async newConversation(params: NewConversationRequest): Promise<NewConversationResponse> {
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
    
    async getRateLimits(): Promise<any> {
        const response = (await fetch("https://grok.com/rest/rate-limits", {
            body: "{\"requestKind\":\"DEFAULT\",\"modelName\":\"grok-3\"}",
            method: "POST",
            headers: {
                "x-statsig-id": this.xStatsigId,
                "cookie": this.cookie
            }
        })).json();
    
        return response;
    }
}