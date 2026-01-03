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

            const response = grok.continueConversation({
                conversationId: context.session.grokConversationId!!,
                modelName: "grok-4-1-thinking-1129",
                modelMode: "MODEL_MODE_GROK_4_1",
                temporary: true,
                enableSearch: true,
                enableMemory: false,
                isReasoning: context.session.enableDeepThinking,

                message: JSON.stringify({
                    
                }),
                    
                images: {
                    enableImageGeneration: context.session.enableImageGeneration,
                    enableImageStreaming: false
                }
            })
        }
    }
});

init(bot);
startup(bot);