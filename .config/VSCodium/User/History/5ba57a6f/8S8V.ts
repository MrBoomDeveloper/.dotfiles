import { Grok } from "./src/api/grok";
import { Bot, Context, GrammyError, HttpError, type SessionFlavor } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import { autoRetry } from "@grammyjs/auto-retry";
import { requireEnvironmentVariable } from "./src/utils/base_utils";
import { sleep } from "bun";
import { sessionPlugin, settingsMenu, type SessionData } from "./src/bot/settings";
import { init, isBotKilled } from "./src/bot/init";
import { startup } from "./src/bot/startup";

const grok = new Grok({
    cookie: requireEnvironmentVariable("GROK_COOKIES"),
    xStatsigId: requireEnvironmentVariable("GROK_xStatsigId")
});

export type MyContext = Context & SessionFlavor<SessionData>;
const bot = new Bot<MyContext>(requireEnvironmentVariable("TELEGRAM_BOT_TOKEN"));

bot.use(sessionPlugin);
bot.use(settingsMenu);

const aiSystemPrompt = `
    Кажждое последующее сообщение будет следующего формата:
    {
        authorId: string,
        authorName: string,
        message: string
    }

    Если думаешь что ответ на отпарвленное сообщение не нужен, то пиши [NO_ANSWER_REQUIRED] и больше ничего!
    Если хочешь поднять свою тему, то так и пиши! Ты можешь переключаться между темами и вовсе не отвечать.
`;

export enum AiConversationStartResult {
    SUCCESS,
    RATE_LIMITED,
    MODEL_NOT_SELECTED,
    ERROR_UNKNOWN
}

export async function resetAiConversation(context: MyContext): Promise<AiConversationStartResult> {
    switch(context.session.model) {
        case "grok":
            const rateLimits = await grok.getRateLimits();

            if(rateLimits.remainingTokens == 0) {
                return AiConversationStartResult.RATE_LIMITED;
            }

            if(context.session.grokConversationId == undefined) {
                try {
                    const conversation = await grok.newConversation({
                        modelName: "grok-4-1-thinking-1129",
                        modelMode: "MODEL_MODE_GROK_4_1",
                        message: `${context.session.prompt} ${aiSystemPrompt} Если ты все понял то только ответь [prompt changed] без ничего!`,
                        temporary: true,
                        enableSearch: true,
                        enableMemory: false,
                        isReasoning: context.session.enableDeepThinking,
                    
                        images: {
                            enableImageGeneration: context.session.enableImageGeneration,
                            enableImageStreaming: false
                        }
                    });

                    if(conversation.responseMessage == "[prompt changed]") {
                        context.session.grokConversationId = conversation.conversationId;
                    } else {
                        console.error("Failed to set prompt to Grok! Response: " + conversation.responseMessage);
                        return AiConversationStartResult.ERROR_UNKNOWN;
                    }
                } catch(e) {
                    console.error("Failed to prompt Grok!", e);
                    return AiConversationStartResult.ERROR_UNKNOWN;
                }
            }

            return AiConversationStartResult.SUCCESS;
        
        default:
            return AiConversationStartResult.MODEL_NOT_SELECTED;
    }
}

// Messages from same chats/authors are processed in sync
bot.use(sequentialize((context) => {
    const chat = context.chat?.id.toString();
    const user = context.from?.id.toString();
    return [chat, user].filter((con) => con !== undefined);
}));

bot.command("start", async context => {
    context.reply("здравь, я AmaterasuChan и я мало че умею. можешь попробовать поспрашивать меня о чем то но я врятле отвечу как надо так что хз.");
});

bot.command("settings", async context => {
    await context.reply("Вот тебе панель управления мной, senpai~", {
        reply_markup: settingsMenu
    })
});

bot.command("rate_limits", async context => {
    const response = await grok.getRateLimits();
    await context.reply(`У нас осталось ${response.remainingTokens} токенов из ${response.totalTokens}`);
});

bot.on("message:text", async context => {
    if(context.chat.id < 0 && context.session.model == undefined) return;

    switch(context.session.model) {
        case "grok": {
            if(context.session.grokConversationId == undefined) {
                switch(await resetAiConversation(context)) {
                    case AiConversationStartResult.SUCCESS:
                        await context.reply("ИИ Беседа успешно начата! Начнем же...");
                        break;
                    
                    case AiConversationStartResult.RATE_LIMITED:
                    case AiConversationStartResult.ERROR_UNKNOWN:
                    case AiConversationStartResult.MODEL_NOT_SELECTED: return;
                }
            }

            const response = await grok.continueConversation({
                conversationId: context.session.grokConversationId!!,
                modelName: "grok-4-1-thinking-1129",
                modelMode: "MODEL_MODE_GROK_4_1",
                temporary: true,
                enableSearch: true,
                enableMemory: false,
                isReasoning: context.session.enableDeepThinking,

                message: JSON.stringify({
                    authorId: context.from.username ?? context.from.id,
                    authorName: context.from.first_name ?? context.from.last_name ?? context.from.username ?? context.from.id,
                    message: context.message.text
                }),
                    
                images: {
                    enableImageGeneration: context.session.enableImageGeneration,
                    enableImageStreaming: false
                }
            });

            if(response.responseMessage = "[NO_ANSWER_REQUIRED]") return;
            await context.reply(response.responseMessage);
        }
    }
});

init(bot);
startup(bot);

fetch("https://grok.com/rest/app-chat/conversations/db25589d-470e-4c8a-9327-d547f126d1f6/responses", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-aa85cc99bda99e98-0",
      "traceparent": "00-6f993ad94d095ed83ff5de64be1b4fba-8c5fd67f5791f654-00",
      "x-statsig-id": "jbnzTl1ZnKaLIzozNNFjBOBYTD2jVzh0mQYRKEYNAR8xOAmjVHcVHDq7cfDYWdmwp4RniYiUAAaVUt+xhZ4ttKgbf0SGjg",
      "x-xai-request-id": "0df1c7af-780a-4bbb-a4fc-c7be15f7579f",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"message\":\"тест\",\"modelName\":\"grok-4-1-thinking-1129\",\"parentResponseId\":\"c50ca230-f229-476d-8990-bcb992893698\",\"disableSearch\":false,\"enableImageGeneration\":true,\"imageAttachments\":[],\"returnImageBytes\":false,\"returnRawGrokInXaiRequest\":false,\"fileAttachments\":[],\"enableImageStreaming\":true,\"imageGenerationCount\":2,\"forceConcise\":false,\"toolOverrides\":{},\"enableSideBySide\":true,\"sendFinalMetadata\":true,\"isReasoning\":false,\"metadata\":{\"modelConfigOverride\":{\"modelMap\":{}},\"requestModelDetails\":{\"modelId\":\"grok-4-1-thinking-1129\"},\"request_metadata\":{\"model\":\"grok-4-1-thinking-1129\",\"mode\":\"grok-4-1\"}},\"disableTextFollowUps\":false,\"disableArtifact\":false,\"isFromGrokFiles\":false,\"disableMemory\":false,\"forceSideBySide\":false,\"modelMode\":\"MODEL_MODE_GROK_4_1\",\"isAsyncChat\":false,\"skipCancelCurrentInflightRequests\":false,\"isRegenRequest\":false,\"disableSelfHarmShortCircuit\":false,\"deviceEnvInfo\":{\"darkModeEnabled\":true,\"devicePixelRatio\":1,\"screenWidth\":1920,\"screenHeight\":1080,\"viewportWidth\":810,\"viewportHeight\":996}}",
    "method": "POST"
  }).then(it => it.text()).then