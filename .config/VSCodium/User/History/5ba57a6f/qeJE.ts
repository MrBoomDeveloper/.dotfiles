import { Grok } from "./src/api/grok";
import { Bot, Context, GrammyError, HttpError, session, type SessionFlavor } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import { autoRetry } from "@grammyjs/auto-retry";
import { Menu } from "@grammyjs/menu";
import { requireEnvironmentVariable, requireNotNull } from "./src/utils/base_utils";
import { sleep, SQL } from "bun";
import { databseSessionStorage } from "./src/utils/db_session";
import type { SessionData } from "./src/bot/settings";

const grok = new Grok({
    cookie: requireEnvironmentVariable("GROK_COOKIES"),
    xStatsigId: requireEnvironmentVariable("GROK_xStatsigId")
});

type MyContext = Context & SessionFlavor<SessionData>;
const bot = new Bot<MyContext>(requireEnvironmentVariable("TELEGRAM_BOT_TOKEN"));

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

enum AiConversationStartResult {
    SUCCESS,
    RATE_LIMITED,
    MODEL_NOT_SELECTED,
    ERROR_UNKNOWN
}

async function resetAiConversation(context: MyContext): Promise<AiConversationStartResult> {
    switch(context.session.model) {
        case "grok":
            const rateLimits = await grok.getRateLimits();

            if(rateLimits.remainingTokens == 0) {
                return AiConversationStartResult.RATE_LIMITED;
            }

            if(context.session.grokConversationId == undefined) {
                try {
                    const conversation = await grok.newConversation({
                        modelName: "grok-3",
                        modelMode: "MODEL_MODE_GROK_4_1",
                        initialMessage: `${context.session.prompt} ${aiSystemPrompt} Если ты все понял то только ответь [prompt changed] без ничего!`,
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

const settingsMenu = new Menu<MyContext>("settings-menu")
    .text(({ session }) => `Генерация картинок ${session.enableImageGeneration ? '✅' : '🚫'}`, async context => {
        await context.reply("Еще не сделанно.");

        // context.session.enableImageGeneration = !context.session.enableImageGeneration;
        // await context.reply(`Генерация картинок ${context.session.enableImageGeneration ? "Включено" : "Выключено"}!`);
    }).text(({ session }) => `Думание ${session.enableDeepThinking ? '✅' : '🚫'}`, async context => {
        await context.reply("Еще не сделанно.");
        // context.session.enableDeepThinking = !context.session.enableDeepThinking;
        // await context.reply(`Глубокое размышление было ${context.session.enableDeepThinking ? "Включено" : "Выключено"}!`);
    }).row().submenu("Выбрать модель", "models-menu")
    .text("Настроить био", async context => {
        context.reply("Еще не сделанно.");
    }).row().text("Сброс беседы", async context => {
        switch(await resetAiConversation(context)) {
            case AiConversationStartResult.SUCCESS:
                await context.reply("ИИ Беседа успешно сброшена! Начнем же с чистого листа...");
                break;
            
            case AiConversationStartResult.RATE_LIMITED:
                await context.reply("У ИИшки кончились токены, поэтому сброс пока невозможен. Попробуйте еще раз позже...");
                break;
            
            case AiConversationStartResult.ERROR_UNKNOWN:
                await context.reply("Произошла неизвестная ошибка при попытке начала новой беседы. Попробуйте еще раз позже...")
                break;
            
            case AiConversationStartResult.MODEL_NOT_SELECTED:
                await context.reply("Вы не выбрали ИИ модель, сделать это можно в /settings");
                break;
        }
    }).row();

settingsMenu.register(modelsMenu);
bot.use(settingsMenu);

bot.catch(e => {
    console.error(`----- ERROR WHILE HANDLING UPDATE ${e.ctx.update.update_id}:`);

    if(e.error instanceof GrammyError) {
        console.error("Error in request:", e.error.description);
    } else if(e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
    }
});

// Messages from same chats/authors are processed in sync
bot.use(sequentialize((context) => {
    const chat = context.chat?.id.toString();
    const user = context.from?.id.toString();
    return [chat, user].filter((con) => con !== undefined);
}));

// Deal with 429 errors (rate limited)
bot.api.config.use(autoRetry({
    rethrowInternalServerErrors: true
}));

bot.command("start", async context => {
    context.reply("здравь, я AmaterasuChan и я мало че умею. можешь попробовать поспрашивать меня о чем то но я врятле отвечу как надо так что хз.");
});

bot.command("settings", async context => {
    await context.reply("Вот тебе панель управления мной, senpai~", {
        reply_markup: settingsMenu
    })
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
        }
    }
});

// Stopping the bot when the Node.js process is about to be terminated
let killed = false;
const runner = run(bot);
const stopRunner = () => {
    killed = true;
    console.info("\nStopping bot by killing process...")
    runner.isRunning() && runner.stop();
}
process.once("SIGINT", stopRunner);
process.once("SIGTERM", stopRunner);

(async () => {
    while(true) {
        if(killed) break;
    
        if(!bot.isInited()) {
            await sleep(100);
            continue;
        }

        console.info(`Bot logged in as "${bot.botInfo.first_name}" @${bot.botInfo.username}`)
        break;
    }
})();