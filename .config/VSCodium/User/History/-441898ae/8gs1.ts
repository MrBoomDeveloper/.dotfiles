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
            // "body": "{\"message\":\"{ authorId: \\\"mrboomdev\\\", authorName: \\\"MrBoomDev\\\", message: \\\"Привет!\\\" }\",\"modelName\":\"grok-4-1-thinking-1129\",\"parentResponseId\":\"a171c338-0b05-44a5-8ee5-ec071e4980d6\",\"disableSearch\":false,\"enableImageGeneration\":true,\"imageAttachments\":[],\"returnImageBytes\":false,\"returnRawGrokInXaiRequest\":false,\"fileAttachments\":[],\"enableImageStreaming\":true,\"imageGenerationCount\":2,\"forceConcise\":false,\"toolOverrides\":{},\"enableSideBySide\":true,\"sendFinalMetadata\":true,\"isReasoning\":false,\"metadata\":{\"modelConfigOverride\":{\"modelMap\":{}},\"requestModelDetails\":{\"modelId\":\"grok-4-1-thinking-1129\"},\"request_metadata\":{\"model\":\"grok-4-1-thinking-1129\",\"mode\":\"grok-4-1\"}},\"disableTextFollowUps\":false,\"disableArtifact\":false,\"isFromGrokFiles\":false,\"disableMemory\":false,\"forceSideBySide\":false,\"modelMode\":\"MODEL_MODE_GROK_4_1\",\"isAsyncChat\":false,\"skipCancelCurrentInflightRequests\":false,\"isRegenRequest\":false,\"disableSelfHarmShortCircuit\":false,\"deviceEnvInfo\":{\"darkModeEnabled\":true,\"devicePixelRatio\":1,\"screenWidth\":1920,\"screenHeight\":1080,\"viewportWidth\":754,\"viewportHeight\":996}}",
            
            body: JSON.stringify({
                "message": params.message,"modelName":"grok-4-1-thinking-1129",/*"parentResponseId":"a171c338-0b05-44a5-8ee5-ec071e4980d6"*/"disableSearch":false,"enableImageGeneration":true,"imageAttachments":[],"returnImageBytes":false,"returnRawGrokInXaiRequest":false,"fileAttachments":[],"enableImageStreaming":true,"imageGenerationCount":2,"forceConcise":false,"toolOverrides":{},"enableSideBySide":true,"sendFinalMetadata":true,"isReasoning":false,"metadata":{"modelConfigOverride":{"modelMap":{}},"requestModelDetails":{"modelId":"grok-4-1-thinking-1129"},"request_metadata":{"model":"grok-4-1-thinking-1129","mode":"grok-4-1"}},"disableTextFollowUps":false,"disableArtifact":false,"isFromGrokFiles":false,"disableMemory":false,"forceSideBySide":false,"modelMode":"MODEL_MODE_GROK_4_1","isAsyncChat":false,"skipCancelCurrentInflightRequests":false,"isRegenRequest":false,"disableSelfHarmShortCircuit":false,"deviceEnvInfo":{"darkModeEnabled":true,"devicePixelRatio":1,"screenWidth":1920,"screenHeight":1080,"viewportWidth":754,"viewportHeight":996}}),
            
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
              "x-statsig-id": "Wg6Vc2x8ywKmqXYOVaY0dlfOtkKnMrdmtmU3VvMlfFf3mE4NjjAiVOTDy3Vx5JlalpKqXl/M+FsN7Bkkx6yShfFBxx1RWQ",
              "x-xai-request-id": "1378c542-dfc8-4f92-b7a2-b4953c3df5fc",
              "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=sik8EYYEs0jfyq8Ff9DyZjmpEIAPg3.8JIcoINZCh8U-1767134156-1.2.1.1-fHPyIhS11AWjtkx5uVHT54XQH_ntsDW1J5QfBsOGMOn7kVp.UUS6f3FR0XOL_8ByKG6rVmFrzZZMhYxNk2HM0nETQbSXdb7k1oyLKFPjwqvW.iFn943PZ4pMpHkjDMgOeS0oggdtjKfmY.UIn_iLfOAirvXGATvffHDHrwTM6CYoGIzjleuo2mhj4_Uu2jP97REPkVaCAZX7SKFSIkpNhA04agEAi_Q9vfimlwn5KT0; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767134173$j42$l0$h0",
            //   "Referer": "https://grok.com/c/7f5e369a-6314-4381-8a56-8bbf65448e65?rid=a171c338-0b05-44a5-8ee5-ec071e4980d6"
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