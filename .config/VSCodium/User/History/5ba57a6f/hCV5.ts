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

fetch("https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698", {
    "headers": {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "cache-control": "max-age=0",
      "priority": "u=0, i",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767131153$j60$l0$h0"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/cdn-cgi/speculation", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "priority": "u=4, i",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "sec-fetch-dest": "speculationrules",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/UniversalSans_Display_400.p.f3921f1a.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/UniversalSans_Display_400Italic.p.c81b3b34.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/UniversalSans_Display_550.p.643f1127.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/UniversalSans_Display_550Italic.p.a4aac43a.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/UniversalSans_Text_400.p.8e69d71d.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/UniversalSans_Text_400Italic.p.1f7b6952.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/UniversalSans_Text_550.p.8ed2b378.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/UniversalSans_Text_550Italic.p.51b28d67.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/9e341644ff7c95b7.css", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/3accd0f30cf3de25.css", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/693adc2050b8bfd2.css", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/eeb92131818473e1.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/963309efef6acc17.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/fee48e21a0ce2811.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/8e3bf4ee1e422bbd.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/fbb2c47c31f5d21c.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/ffda43e9b0e1f91b.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/339751619e1dccce.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/turbopack-c91b2f40b52f4a2f.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/e5b11d23654a7ad6.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/e11a3e2c495bbb50.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/faac81f5230fb6f6.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/58e7f19cd4b34ebc.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/dcdf7d6886d5ad11.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/7a9b4a0b99211c68.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/3ab63b22fa0e3b01.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/b32549a03fb595db.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/9129f6ba3dcb94b0.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/0d269e9664998356.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/af112bf5c8f2e452.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/8934e195551ea62a.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/cea2fe2d28bad88b.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/116b49148bdcb893.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/6bec224c1d95c780.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/a2108e08420a01b3.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/27be5e183471de3d.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/9d9be83e342c70e3.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/b28255b4b6214f83.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/55725cb9ff4bcc46.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/0e6d76ce94f93e7c.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/054486ef162c42ea.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/6e455528dee7261b.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/baefd8e540865f4a.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/b5ad0bb3cef13d58.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/0a06ce47a13b99d1.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/7b335129b70f9501.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/2e7dee04c11fad18.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/44b83ceeccc17866.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/832f0b23c07639aa.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/91e0020b785b0984.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/accf723dbad14a18.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/1f0cca2447e9adb0.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/2b8933b8b010d818.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/fc6c554c4a667a5d.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/83caad36554b610c.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/30b440b1df9f4486.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/25dfb1a200de48aa.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/b9cb3861893bf5d0.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://www.googletagmanager.com/gtag/js?id=G-8FEWB057YH", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "priority": "u=1",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "script",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "cross-site",
      "sec-fetch-storage-access": "active",
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://assets.grok.com/users/02ae5531-ca97-4722-bee2-c289c7dea8bc/0Aq3fgfMzlStQqeS-profile-picture.webp", {
    "headers": {
      "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "priority": "i",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "image",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "same-site",
      "cookie": "sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0",
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/monitoring?o=4508179396558848&p=4508493378158592&r=us", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "content-type": "text/plain;charset=UTF-8",
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
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0",
      "Referer": "https://grok.com/"
    },
    "body": "{\"sent_at\":\"2025-12-30T22:06:31.589Z\",\"sdk\":{\"name\":\"sentry.javascript.nextjs\",\"version\":\"10.29.0\"},\"dsn\":\"https://b311e0f2690c81f25e2c4cf6d4f7ce1c@o4508179396558848.ingest.us.sentry.io/4508493378158592\"}\n{\"type\":\"session\"}\n{\"sid\":\"0d99af7fe2c347ffa089b4975fce02f9\",\"init\":true,\"started\":\"2025-12-30T22:06:31.589Z\",\"timestamp\":\"2025-12-30T22:06:31.589Z\",\"status\":\"ok\",\"errors\":0,\"attrs\":{\"release\":\"5369b5704658896f32b5298b2b962a22b9812b00\",\"environment\":\"production\",\"user_agent\":\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\"}}",
    "method": "POST"
  }); ;
  fetch("https://static.cloudflareinsights.com/beacon.min.js/vcd15cbe7772f49c399c6a5babf22c1241717689176015", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/cdn-cgi/challenge-platform/scripts/jsd/main.js", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "script",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "same-origin",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/cdn-cgi/challenge-platform/h/g/scripts/jsd/d39f91d70ce1/main.js?", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "script",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "same-origin",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("chrome-extension://jffbochibkahlbbmanpmndnhmeliecah/config.json", {
    "headers": {
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/cdn-cgi/rum?", {
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b828a78ee4269b1f-0",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0; mp_ea93da913ddb66b6372b89d97b1029ac_mixpanel=%7B%7D",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"memory\":{\"totalJSHeapSize\":152925906,\"usedJSHeapSize\":141730106,\"jsHeapSizeLimit\":4294705152},\"resources\":[],\"referrer\":\"\",\"eventType\":1,\"firstPaint\":620,\"firstContentfulPaint\":0,\"startTime\":1767132390876.8,\"versions\":{\"fl\":\"2025.9.1\",\"js\":\"2024.6.1\",\"timings\":2},\"pageloadId\":\"a2884c21-95ad-4e27-9bbb-58a30cf15f06\",\"location\":\"https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6\",\"nt\":\"reload\",\"serverTimings\":[{\"name\":\"cfCacheStatus\",\"dur\":0,\"desc\":\"DYNAMIC\"},{\"name\":\"cfOrigin\",\"dur\":0,\"desc\":\"\"},{\"name\":\"cfEdge\",\"dur\":219,\"desc\":\"\"}],\"timingsV2\":{\"unloadEventStart\":435.29999999701977,\"unloadEventEnd\":435.29999999701977,\"domInteractive\":856.5,\"domContentLoadedEventStart\":860.2999999970198,\"domContentLoadedEventEnd\":861.2000000029802,\"domComplete\":1134.8999999985099,\"loadEventStart\":1135.1000000014901,\"loadEventEnd\":1223.2000000029802,\"type\":\"reload\",\"redirectCount\":0,\"criticalCHRestart\":0,\"activationStart\":0,\"initiatorType\":\"navigation\",\"nextHopProtocol\":\"h2\",\"deliveryType\":\"\",\"workerStart\":0,\"redirectStart\":0,\"redirectEnd\":0,\"fetchStart\":0.8999999985098839,\"domainLookupStart\":4.200000002980232,\"domainLookupEnd\":17.700000002980232,\"connectStart\":17.700000002980232,\"connectEnd\":115.5,\"secureConnectionStart\":17.899999998509884,\"requestStart\":115.5,\"responseStart\":405.79999999701977,\"responseEnd\":642.2999999970198,\"transferSize\":61778,\"encodedBodySize\":61478,\"decodedBodySize\":235862,\"responseStatus\":200,\"finalResponseHeadersStart\":405.79999999701977,\"firstInterimResponseStart\":0,\"workerRouterEvaluationStart\":0,\"workerCacheLookupStart\":0,\"workerMatchedSourceType\":\"\",\"workerFinalSourceType\":\"\",\"renderBlockingStatus\":\"non-blocking\",\"name\":\"https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698\",\"entryType\":\"navigation\",\"startTime\":0,\"duration\":1223.2000000029802},\"dt\":\"\",\"siteToken\":\"115d22700e41497cb28a5ee6c20b51d7\",\"st\":2}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/images/favicon-dark.png", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/df99d1b6d91b23c6.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/707437bb2ee6ce75.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("data:image/jpeg;base64,/9j/4QDKRXhpZgAATU0AKgAAAAgABgESAAMAAAABAAEAAAEaAAUAAAABAAAAVgEbAAUAAAABAAAAXgEoAAMAAAABAAIAAAITAAMAAAABAAEAAIdpAAQAAAABAAAAZgAAAAAAAABIAAAAAQAAAEgAAAABAAeQAAAHAAAABDAyMjGRAQAHAAAABAECAwCgAAAHAAAABDAxMDCgAQADAAAAAQABAACgAgAEAAAAAQAAAICgAwAEAAAAAQAAAICkBgADAAAAAQAAAAAAAAAAAAD/2wCEAAEBAQEBAQIBAQIDAgICAwQDAwMDBAYEBAQEBAYHBgYGBgYGBwcHBwcHBwcICAgICAgJCQkJCQsLCwsLCwsLCwsBAgICAwMDBQMDBQsIBggLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLC//dAAQACP/AABEIAIAAgAMBIgACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/ANT4Z+HNTsrGHVtUeWGS5nSO+TOMsMrgAfNgNgjAq/r3gexjifT/AAxcC54kwvyyNlAQc7TjC569uOK+zfDnwq17Ut9jbIGuLT926khS4UZyXJwuDyB618n+ObvxT4Vv7zRLKz8maG48qaVo1I8iVBjaFPO4cA57+1dWYYbHY3MFh7pQXR6+id7K3on2PzbL8tx+JozxqSfvWd5cy5Xp1SSt5Lr0dmfHkHjP/hArWHUNXkSa0trgrNb8h8LjAUv90McHBFfT3hT44+F/C2qz3dvZwztfmL7S8UZCpznaST82BwMAV4F4+0DxDrt0NBsrJJYZ7fzJJljHmkNxtBB7dwB2rG8K22km+l0i+059OdYVid0bZsztUjA5UccZ56V3vhmpSw9WNbm1aha61V7p202721Xkfs/EGR4TCYDD15yXMkmkrpNOzdvWz1tfRLyPpubxzZa7r8NlcXT2MU1wby2SHB+Xd9127HseDwa+idKgurvU5/Enhi5uIo7bdbkXDllSPj50ySF/m3tXztrvw00bwl4TspdBH2h1UhZlfLbuzFm98dK3NGXxGNPttVESveakdhtpT+7hwpQNx8pBGMcEn2r43O6NWrLWvy0pL3YpK1k9NPs799D8+xHiBGhCGFp0Ukm4ybS06L3dNLa3fZPpY9v8N5uNWu217YNSnZ40EoPlttXHsOBg8A5q94q8Uw+D9WsdOizNcOqxtIYVMWI1bKqkfRRgEZrg9O8Y6dptgtzoNm11deZ5DyXfzeXj+GISc5UnAI7cV6X4Z8O6lo9/deM9Wkea205T5j7GbO/qPunKjIGAeK9TJeHqWJhLE4qremkuVJWb0vaKs0ru2/Q/HeLKtbD4up7GD5G2uW9rJJNX6Wd7JdulkeIf2l4jk8Tap4lkgi1cTxorJtUNHIhw2CMfMBggdxxXuFx8SrWz0bT9A8JpHJdX2RI90qzEsSMDPHyjP4dK9j8c6T4G8ZeHYNX0G18jT1QqFiKo43KFLSD72W5Kg9uvpXw/f6H4b+Het39pFqd1Hc8EKq7VlRhsHllui8DpX0ec42nSwsVBONeEdI/3LJWdnpsrNR001tY9zgyss0q+y9o4zUOZ30vKySTsmnZaWf3rQ9k1fXZtQu7vRbWxih1ABjJGgBk3qpTGzB+XOMDjH0ryOz17XdKWODy5bfyPnmlXYxCsMjaeMEEFW/LFZHgi/wBfufFLeGLeTZeXyJBDdTNl5QPvjB+6Rjqe/asz4p+JdU8Fa+0OoBZ7aBZIVR+cKOhPALZ/HmvxjMMux1apLA1qaUqibg777K91000Sv+h+/Us2nHB4bK/dlZK6u7JXs0o7vfrbqux9T6Hea/qjR6p4kaO4T5Uj+1fehDLtwMjACk53E8jAxVeXVrLS4ruLTS0Nsm0QS4V+dwGdqg88dvT1ri/h18QkvvDsZ1LNyk8irEqJvcSBQM56DjK+3Qc17Fqfga8XwYvii1hBhVo0xu85opM9OEAU8bVBIr6DgPLq2Bw65aiWvI4aJe7/AC30buu1tdr3R4XE/E7wfJJQU4qy91cqtp9n7r+b08vC9Z0rwtD5l5PZyXtso8+4lkiIzIx7Hg7OvXoa8p8aWkV1cLrXw5jihtI4hGhmBkYyEHIO7jLY4I4GK+9ZmtNV01tH8QWUlpdXQwGKkeah+8+SNq7Tjco4I6cV5n4e+DCah4dm8OXwOoTR3ReHykRpFU9HJXoqjoOOK/R6GHliXONerqrRlaK2630S263XkjixPF+NxNP6xgKW1lLZdej0VlfW/npof//Q/YT4i+EbPw3o8MFuWSWMosrXON4X/gJGcdsdK/K34m6lrXjfXh4A8EX91NfQoZS+zdGTzu649BjPAHtX64eNNV/4TjQTbCPyZWjz5s0YJyBnaSM7RIc5PQHGK+JNIg8Gaf40vdBOleTqEcP2hLtpTGTgfOUAGD24z6Vh4eZpiMZh74uS0vZvXRWs7deqVnseJWzGhhoTqYem04Xt8PLO61ber0Xa34nBeC/hrpui6OsmtwOZriRVLQtt2uozwR90dyMYr5K+Kfwr8MaD44+w3l6s9zqbGTzVfMkXyAFSMFcAfNn8sV+gXibX4/D1kvhzW41EF2w+aHy3IO0HaXzgHHf3xXnfiTwF8PfFPhGfUoA5vpGHlQBGJRSDleAOWHX0GK+vy329TEyxOJndW0jtfe2uuisr3elrdkePnvGGJrJxo1XJyiraKXKtLcnRpW/S3Q+Q7DVW1zT9Q8O6NcyXEFpbxwpcpEfMYbcDKjg9AT6Yr7Q+Fvg3SPD/AMMZLvxJdrHqZZfsYK7mjbA2jAwN+RyOmMYr5z8N2eo+F54pNH0udJmheOSNuqxgAnBOB29Oa9Ke9j1H4eNqOn3cljezSLdpGX24QYyEHQn+f1rnz7JaGKw6p0E+bR8/Kr3dotPSyi9+1tNDxHg6S553cZculteba3TZeS6tXstfWLz4ZzapaG2u4PMWwYXDTEA+bCeQu0kcZyc84IxXe6yQ2gQ2kV8X00SB3g3l32AAshA5P3ee3SvEfEHxP1PX7HTNOtfLS+2RhJp0AyMZZc/3sHIyPeupm0y/8PaxLYaDPJbXUVvCJN5XHILHaACBjuB1OMmujI83xmR4WnDERhGmnqkrtXaXZpafdoj5Gi8VnDoyqUVz9FZ7arVaR7PrpZbDtE01dZSZNPZbVruVG8m4iZ/KjQEIQpIHXrwfpW14d8AanqWpRf2xLH9mEpSKaRVb9zkbyhwCB1yvatf4Zrp93ZR6nZ/6c5RkZ0G5i7Y2hR13rkggke3SvPfEF98RND8XTfayYZZZSTFcDy8qeG9eAcFuxNLPcZgM9zWphXC/Kly391p7JK1tlvzX8kY5VhM4+vVFTk6U27JPTmsrKyUVba2+h33ijwf4T0q+Sy0i8iWGGWNzcwuD8rH5zv8ATaOcY2kV8K/Gq9l8Ta0J47iJZ4cojTLkYGcLg9FYYwR3r6/+JV/4P0/T/wDhHvDtmx1ia23SRLlIVdFJyM5+Vwep5OBxXwl4r13xV4msG0DUkFpeBEilkuIhuEUZyACP65z6gV8LisBVw9SlWrU52hGyutYra/VWvZ6/cftfDlHHVPZ+1qRdSLWmi3vdpJ63evnex6VpsHiex+HYi0uENc2zGTaAVJQ43b2PTb1GCelfeXwc+IMtt4QPhrxVMJhNbxtBE7/6uWLbnZjBcY/vYr82vBvxF8af2NPpfm2ihZkx57eW3luPu45HzbQTtr6y+FvxQi0zWYra505/MnjSOPyijgBWxhc/dbj0+auTCfW8fSeHjT+Ft7vXSN+yTtdXS6dtD6vxMwOMqZXH2VGKcuVScVeTXXp9ytp5WP1M8IR2/irTBbairNFPEWM068IxIXAHXBXHJ7EelVtI+Ff2e9vRq1rJZr1jktsb3GAu3BCkrnp69K8X8G/EfS9S1K1voyXiiQiRIpOEjiHJ5AC7Sccew4r3m2+Kur31jPE+T5XmNbSgh5ARyyk428ADavX8a8rNsVj8tpSlWmox8uay+el7W81torH5hwhkGYUpQqtunTtyuFnH5vo9fia/Bn//0f1H8M+ILC08BWMF3ELxZpkkcriUqB8sZZRyeufYV8j/ABetrH+3JNa0+/NtqZyEHnhG5zuAXn5SepH9KT4d6+sXhv7NZTSWcL2qIbadfnZoRllJ7c7cYHNfEOr6i2p6jeanZRmCbTZ2eVRkeYHycFuSNvfjvXw2VYjEZfN05OcZRd1pa6vb3raO2i+7VHFxJlWHxNKVPDUmpfC7apX+0rfDFPTa1/U9lvr++1v7Ju1Vri+iR5zbAxyYQHawD7QBgrgcivqBrq68EeFNJ1m5vopbB7mNriOJ18zIODkryAc9Pw5HFfm3oF7/AG34qj12Zpo7jTImilhtgfKmVhkDHDPjHpgGvqDTtasPBl/p9tf3Ntc214RELW54+eTHydRu+TqcDBwPav2CniHpSnONlG8bRsnfv2sn0V+r8vnck4ap4hRw2KfLUp3kotLr0TWm6XTbbc+utC8GQeJtK1H/AIRWPyrK7zMsspXzUVxjPzZOMjG3+GvjH4u+HLf4bfGbRnvJptS0026w+QQM4h+cZI+XrgLjGTX2YPG0/hbw8dZEGn2MlwwbzZDtmCoMBEGCo+uK+E/iT8YZL57jV9ZkM9tFIfLkRAwBxtHQZHOCcDFZcPTrUsXehHnpP3d7y1S76303062SPZlg45Ovr8vfh8OjSik166e8ra9rdz0K616aHxrb+NLe3gi0vVPLQW+FWbeQeFU9Dj+Lgmvo0fD3TviFJaTxyvaSQRDzJDKJZZ8DaRuAA4JA2gZIr8o7nxf4g13xKmpyRzTaakfnNbwrmSOXcCScDmMeuRwORX1I3xu8beE9H/tO21D+zbG2lj+yR+WQwWVv3gJGMlh9ADXrZ1w9WpWwiqNznHWzbstLK3lda28+x9Dg8HgcLhY4ieleKvotN9Fb9V5dmz9BPDvh3wp4MZvBsyvp2oSuGuD5gX91nCKoJ4dhjBXnt1rrfG/wb8H6Vql7r+pXAvb+8cOtu7PiOEDgbT/FjHT86+ENJ8XfFP49XreKvC90bKbTkjtwl0gG/LfKyjsMtgkdOor1bxr4h17RLJtMvpkj123UpiNtnyLt2yc8SA4H51+WYOvLBZj9WjUUqrfNLlbbutV/26tNEeRxa6ChQzHDyTnZppXWrto7R/XRK7tY7jxDoeg2diLqK0zqfmp8pDu6LKpRCzDAGB6D6V4l418BWPjTxHL4hAaC+kt185Su4Iv3AxXGP4eDz19q5zTPHnizx9FPrU8I002g2NcQyfvnUZ+Rlxx6qB9RX1R8FfEs934cv7LX/uQxFlnu9pkliK7QC33vQEdhXq5xisZfETT1XLu9FovdW63tZbn23DLrPDUpShGLXvWUdbW2u9La6W/C2n5j3Xw70nQdRk1qe9Op6hOxVDEQREB95SoHAXkYPU8dK9+8Ja/pOieHEeRwmuQ/NbXBjEiSR4YMGHYcfLn0NdJ8SH+Hng+WXVvCkkU0WJJrgEgtyg3LtAyR1GegrzPWvGWiwadP428Jzzw2ZiS1jaSJfKIIAUKOM452se/WvQwGAxrwLbn+79pZ6NPS26fw9tE010SR5PGvF1fLuajhlFKKWqS30tZeVtFb71t7L8OviTqVta22n6pPHDbld12gYRYI6oy44DD9MdK9aH7TPgHxH4faz0JTaS2zGDMo3xJG33cY74HBAwAK/Obwr431/UL0COeC71SKf/SV2ZG50zuZhgc8ZXoce1UotA0yOPVtRuzLBNJOXazT5Q+GAcKey8dPUcCuLPMlyyvTdOrOWrtorrV9FZrW1k21tsj3OEsTQzCEIYuPM3q76O+6TWzt3dlbdXP/0vRIPFdhDoC+ImvbeO4WPzEnnUO8gYkGMDopPUFR24ry7xrf6Nq/iYtbRvYedBsREU8qo3FsHgknrntXml14hvNN8K6X4c1BUjeW3ieO4jIUuMDd1HBB+ntUnhfUbjWfHVrf+JFmWaCJ0iZA8kSkfe3HAAxjnueDXo5xkmHt7XFL2dZOSjs7/krOyfktlsjlwmHtlVXESdnG605rarpvey2+fc9W0rQ4fCulf2hpzQz3USBY5OY2/ecFQp+9wOOmKzdZ8PXVva2Pi7xNaPBaAmZfNjK4LNjDFR8pHqOmPeu8sdI1S48OPf3FxaTTQRSlGK+Yy9gSWH3iv3QOcVz+jawden0u38Qo0OlRbZGgL5LbVztx93b6dTXx+Bz3EKmsvxEHUmm430Wmq08uzX3o+axeV4yphfrWXTf2VzLR2W1lfVt22v8AM950mw8FeIrCK78ZRPqTWcYlT7KGZcsBsyCRhmPHHUV8OfEyDxz4f13/AIRW7jtozOiYthnywjHdn5SM4BHRck19LaL8bLfTbW58L/CvTPs8FrPtZLobT5eeidmHTAGPStefRX8Q5+K1x5F1aabCVHmbRCFIIKY4JfPvgCvs+HatbA4yWHx9o9F12V4x0vbmT9bbbH2WU5VjMNgacszoupfdN2kkr2svhWrto+jR8qeEWutT0SfV9NT7VIWa2Mbr5Soi7g3K9hjoev4VxHw/vk8V6fq8HikyXE7XIEUbr8qIgyPl64/u9ux5r2W78VW2h2UsOgMiQ3yFM7FAjYHnIGQPlYhGz07Vw3w/y/iYtrDpbLERseRN28SjoHxgbuCM8AYr2P8AWjCU6VepChyXaWj1fK0mk7bbf5nmZ9h8fPljh6Li7J3lpJKz202SVnt+R9UeAPFFpZacLjw5df2V5cISUkhWQfxH0VDjjHP9NrTPD918VlN1rDXFxewpLDBcxrkYj5+c8YOAFHY/WsbU7LwxpHhy2vblobyyvdomRBtaExdEzjDDHzNjHuKzfgJ458TaG8l5oNuv2QGS1hEinZHG3PmMOCcL2xgd6+AXPN1cTgaEYtSfK7/Auzejbk9O1ltY8Opg8wweDq4p2qU7pf5W7bPT8T7d+EWjXOkaJcaZ43WxNlbP5CxtGC8n9358YBUDvyfWuY+JepeH/CMtzq3hONJhP+78poA4ijPBbBOdpA+U+vGK29T+IXwl8M/ZNOsdYW+n1LZbNu/exxlG5yoOwHGcAVlaxeeG9Y8OXP8AZenrDfRGOH7RNtURRNyuwcg8cBWr1Mly9Vca8ZitqjSt8MOz08mmu+ttrHuYHiPNsLh5VsO0qajo7W0fk9U19y2d9UfC3xf8GNpejXPizQLyKU3sSx26XamMeYeWUFecEc+hxgV+eWofEfxZqEdrYLcXF3Z2hmiljm+SP5W/iwBhfQ4r9TNfvIvF+mXPhqCeO3lMLPB+6/dqwHbBB6c8Y6cV8T+HNDu9F8VX8GtwJqVvtLLLEp/euuM7jjJHBI29+tf0DhspWByyvTtzRUk07b30cUrb2817ybPKxs8ViYKtWlHqua3ly3t0tolZJbpaIxvDWo3tlqkkekadJLHqKowW3AjmEqdNpPLgD+de2WOia3aaYb/xpK8cD+USflG3DHJ64J+UZb17dKsXFhqUELeK7JUNxJAkdoiA9XOAWJzt29Pw9q+f9f8AFfjeOI6aqQSX0itZopc4hUHG9SflY56ADjrzXgVOGqtLCOtl3KqStp12tr0aXy+846P1mjJyptQWm+92rvTRpO1nKz+5H//T8s8U+BT4n8PGDUInU2MiyC1A2ZjjHGN2ORnj37cV1/g+58L6Xf2dmyTiJ08tEEhyGOBvzwqHZwen0r1rWfFj3tifEXiUxq0TeYUuTsZnGNpQDnb3z+YrxrXNPs7XVJfibpzGeRbgTKFBNqgf5OY+4Az+XFexxs3isP8AV6EX7vwJNStJW63WluqXlqej/b8aOVfV6cbW93kS0Wis1Z6/Nr8j6x1X4dx6ZbDWvDE8rW8aTKlgy+bO52YDDGAGAHyk5/Wvja3tvFazWOjxSzv5u5ZQxErwxc/PvwMbDxye+O1fSuiP4/sr6TXNT1D7B9rizahtrK77Rjc6Y24wNoFeWa1qPk3umXdhaWkqXKPJc3QdsIwz8oXPccgdDk1+acOZZUVSNSpNzlC7votbPTWyevzXbofLcLVZ1sxdOpVSun7u2urSV2lZd0tPlYr/ALPvi7wR4L1Ca+8TS+ZaiVAiT4zNzheQecYzkY96+xL+78J6tDqGgaa8EumXiu6xRJjaCCQUOMD3B6Yr4x0PwTbHR73UNStrS2tIkXbEmD5Mcjf6zByBkdMV0ngzSvER8S/2bpVwbyzvcSGGWUEJFG2VAC5LBgPunivtcfh3mNdZlg6ivBcrT5dUktvs31V72btppa/1vEHFkowl7eKVSXLHTV6Lom3a29yWPRLjXPDV1czWSXFrpr7LZkGVOACNzKoG7AOR6eleOfEHwx4uNzYWUAuEsLhUCQrGsK3EmdwEZA42t6noAPavurw9p1r46vJvDsGof2XAJJVighKMGERJO8gDAHTpz0rxn4m/Er/hCbew8OWUX9oCK9j3OsW3ZGPmAJ6Z45J4FcKyvH4rNaVH6vbqo3fK7rR6enTS7djgln9KrSp0VHlsk/d5XK2nr69/PYo+AtH1HR9Og0IwtcPJvkm+0S/KzSYLeXnnOML2Uda95tdU8CeDbCf7HAZCikvZmTdm4ZR14wRkAADrivCbT4k6cvip5/DlgrEQlWaRVZ2DkEKOdvyN/SvQl8G6anh+K5mlmt7qS582V5EaOQ4znG3JHoCPpxX6DgMpeGwjq1cC4/ZaW7b1Ttv2ts0rbHzuYZtiMJiVHDxcIaO1lKO73erWmit+h5brfxJ0rT9dj0fW9OlN1PJ50RiRSEdSCp46f7vSvP7f4oS67q959oWa3jUMoijm4RgPvNjPcD6V6X428KaHNd/2xp9w73KDNqskW7OTxGecDgbh3x+nLeFvDsPjXUbzVURtKlsJF2AQYjnni5yd2BhucdiAK+2yhZMsFVqrDyVSMbNO7956qSVu3k1p0R62Aq4yngFRxlFqHu9G73bs93deXl2Oc1vVPEVpeWfizw8BBZamY41jlyG+UYO9B83IxjjGOvFYnhHWdM059bvvEcwt455VRHhk4cudpEXGeepUYA9q9h+InhzxTrOpWwNo0swDyGEHbuV+FUbeAw4JU4FeW+LfB2r+ENRX+0IJLiK1bduiwTbuSpIOBgccDrXBTzihLC2xmitZWs27NNaaLR21t8uh+nY/hjkw+Gp06cYxUedu1m7vdrq9Oyv0W56v8IPEXh7xDp+q+H3/AHDrbRAzzKPLMKH5iOvIGfxrA8Q/BzS9Q1MvFI7RPOZkCZLBMDYBkA5yoIGTXFp8QvsetX0+h2v2cbViCLE0ZCsQSU6gndy3bjFejeGvH2ryTfbbiZbe1kmlS3+Uq7NGuRt5IA3e30qMDmyx0XQqU+SPLZ+fLtbl76NWX5H59mHBVSljamZTjzNRvFWdoq0b6aKzW+nyWh//1OG+IXi3wj4oEmqaBI98xjCI0kRVcBuCV+vp2/CvEPDvxBm8B6Jd2cd0j3crGPypQ0qQlmyMDPCN9CRipfGnjjwP/wAI7CirFIiswkeHDyx25OMr0BI6+3p0r568NafYL49fX7m+V7EsrWo8naryIflRgO2BljXRlOEhiMJKjWbVVfDe6Ttqou236an2lHhudKn7lFtSj1V762u10W+y7aWP0S8H/Fux0LTRFrAjnuL8tM20bvKI6HaOVBBAGBkDrXuWr+A9F8WaOuoNqT+ZIyzqoUORDtxwh4BUfLgelfnrpZ07VPD0d34fngsZppJCXPOYX+Ypu6bM5OB0GBXuPwc1q6srwa740vEWG9ijhWVjtDLHkZTByAT0zjOMV5GPwFVtVKU7Sjo1FW100v562727H4T/AGdR4fzevKpL393ddYpvSPwparbqtup9TfCb4eap4q8M6joeqxGGAQmSO6mVctGjfKck9h/Dg9OcV5hpkGjfD6O88JyXvnKz83rqVY56AH+FTnqvQcV7bqP7RHw9iiuNN8FSm61K0Hlosg2csMEEdwRzur5bvvBuvzxan4jv2FvJK5SLzF3s4PTAYABVP92uzhWh7DF1PrFlSm/dVlfva26S22WvTTT88zjN82rwWZTg0lZqOmi/y5eqWnmrM9XvPD1/4Qlt/Eds0csXkx5JVvLZ5ixXrz/vfh2rxvx/8T/B9/rC+HLSNvOuInivJE3fugVHzcAg/XjHFbXhDUfEGr+GU8JtbzSXKPE6xspe3xGoHyuQNqryQ2cdqw5/hfaaZfusUn2yAFLq4nOUjCSMAo3D+EDsevbtj9YyfBVamaKriaiS0Ubae7pbay0/M/YOEMRQzHLalfEWU9bbaXVr9+iSfna+hq/CD4Pxw6zFqPh7WW1K4leV0hibeI/k53Eg5+Xp24Ffc3xC8RaLp/w5XTbqGSSdU5l+UbSoyTnsnHckjsPT5o8FRW9xf3k3hkvpV7Yv9mjXhFMZVW3D8OPT8a8j8T+K9c1jUbrR9QbKC5IcqPl+VcDC/LhQOOR+le7xzUVajTnKaapK90rW5bWv0t21117ndi08by0sNG0kk2rJXklf4fS9tLd9LmJd3fxH+Jviux8L+ELSSzhIjuXm3qA0ajrwMEYOMAZxX1j4b8TWngTw3Ja+KZIzdQh1Yy9FcLtVdo9unWvlP4LeJp/BloRrlsyRLM8UhLFP3ZJPHPOD0x+Fdp4l+Fa/EDWZbvQ7+7mUK1zBjDg7QCFKj+6Qc4xX5fwtndf2nJVajhpbSsved9FrdpPSyW3S59JisOqNGmqzbkkmoq8lok7Jr+VdG1p5aHSW/inTp7O71eJJUt3/ANISeOYlRtPORy5BbotcZo/ibX9T1yTWbSx/0O7hbBuXcqFj+++3bjI4xnGeKs+J/EHhuPwVD4J0qYaHqW5S8jELGmwrkkjP3hnIP1GKydQ1WJ9KudN8+4iWFREZLd/PMm7rIo4AQdMEfSvpcxr5ZXr1aU4/u4P3VzPp1sny69Fpqtup31qOavAU3KvL321J2+FWWjsnKWnL5dEebeKNXn8L+INE8RaYsEZs5PMuJXwUPnZAI54JJAI9+ldH4dik0uO78SeIXt4otSukkiu3H+p2gFlC9dvbOMZr56sbK50vUvseou1xbqU8oTEJHKGyCoXn/VgDcOP8PXvFtp4et7+ObxFdtJG0UfkRpIFiR1Xj3PHbnGMV8fiK9Ghzqnfnl580lHdJJbW6q3f5fU/2PiMPh4Yjn+yknFOSalrtZ2/Ly6H/1fyps/hdENQtJBqEV7btcqVaRtsBhbJyvbIwcDHFfQ+ofDTRr/VIln1FDFb2/k28CsMoP9rZhev3WNfI3wq1M3cDf8JJOfsWnkhLeRScYYgEqAMDPpnP0r6Is9dksNbgbT4JBFdM9vmVd2FyBgqOcDtx8tfTPD1XH6tO0Wk1Lo9bd/z6bev2HE3FuKp1Z06VeXuqyST3VvTRre2ndbHo3h3w01v8NP8AhDtO0wRXE4kto7gyfM+OvVunU8dCK+gPB/g3R/CvwiS11V4m1CzliUNKM7EkfjKAHdzxjgAda+XbfV4G8S6RpK6nI13cS74Il2qWiT5WTgYI9v8ACvs/wt8Ory2sbm58QXQ85EEpEzfu0+X7mcYbp1ya+fq+zw0o4rE1/wB05NtJybXkr2vqvz9D8V4qp1cTgnjFPlnUve3Xdb2WiVvJvReXhkd7rPgjxTP4u1qOZjJhraSONTv8rPyF8fKemAB7Zr6k+G/ibS/Hemi18YFjcyMUCmVjFDJztKEqQTnOR64FT/8ACHW+v/BS2hDzPJsR0JXywDvBK4IBySRwe1eVeHPB/iPRZbYLpl9c+VIcSoT5e6I4JXsQGHXFcOU/U8zxc8LVr3k3yx1tpH8vl9o+GlmX1zCxeIi17JWaSsuVbPXS2myb93Y+6/DmlaP4X8JLqyB7qWHbHePHmImE4UrEADkDjpwcVmfEjwv4d0/wfbalpenROrKCiBWMpQEOpYnjIGSAflA6Va8J+DfEl/4lTTtMZotLnhjNw7yFmQ7cgDOOpGOwxV74wi8sob6wsrlULwrIbR8bAqgKJE7blAPH3ea+meZVMPj5YZNuC5ZJvaLaSSd+iXp8j1IY11cJTlhINQetldWj020Sv02S6pb/ABF4ltY7GeCfT5l867Ks53LtkxnCj/63Ga0rCfwcdTbwqzhpYykYVxneBnDfNg5HTB/DisW91C78QeOjqP24agbclJHfaUwV+XDbdoVAew6iuq0Pw74M0jx7BqGrXP8AbV5LEMyKdqERrlAB0GM8N3+nT3c/z5VZTWKpv2HJ9nmbdtlbVfLTy20/buH8OsPCtmePprmsnHVNcrutrdttf815f8VfAUq+I/tCah9p/s6NJ5baOPYobGdueAMen4V3nw4+KOk6j4et7XWZEtrdotrRz8SFgcq4K/eBH44HPSr/AMR/F+kaFdS6domnm3g1B2K3Up3TTEFTgg/dUEgLnA44zmvPdX8EW15bx2Hia3vRflI55r6FPLjUMcFcKSABgZPA9639jhKeCoYqMeSnNLlXLrFJNJ2T06Py03se9mGYwr5ZCbjZOy9x+9C27jG1tV56O6e7Oo8W+FvCV/bJ4ijKTQJdmGRyAXxg4cDBIGBx7V4hqVxolvaX2m6DYNbzX8khe4jJWVC3y4UcH328GvoDxL4XOo+C7TR4bhNkEBe38uMRMdmCykNy+F5P1r4i8cWWreOvE1to2j3jQ7YztKgh8RkNu+XGCANvHPpX51mddVaaoUavPLm1va1o7LpfVW9FbQTpwWXyr4OTq0W7tWcbPZtpenp9x4019eeH/EbXt7JPq0GnNLDE24hpASAQyZIYr2J7cZr1PStR1nWLG0n8UXFu1vD9okimmXcAE4V1C42ja2PccV6Fp/gXwjH45soNGeELIIRqsk6H5f7pjbuDjbgd855qr8coNB1Wxu5/D08NncWO4PbwL/r024UhRgA9TjpwK83BU5TzCpVlG/tLrmS1taySSukm3pbRp7anq5bmWJrqFCdSyns0nHkSSVkt7PrZW0XNbY//1vzB8VQ6j4qSS7sP9AaMiPyc7CfKzxuHGMYycV7XaaGum+FoJhC0QeNog7vtKoMHdnBLNnP3eoFe1z/BrRdb1ec6HBKQS7sJEJaOVySAOccjI9OfarOlabp+qwPpfjQqkCSeWMLwCu1Qme3TnpXJn+Z4yUpaON3dPbS/4qy6nUnlnt/rGIdlFXjrdvX3fyXZtr7vA/DWlavqms+V4cRniscrGhjztSQHLjqxx2A4yRX0J4d13Wf+EPk1zUIpJL2BFRAqho0VH2vkNxn1BANevX/gqKK0guvAUMFpDjax89QwCLjC8g4HUY9q9g8OaZDf6cbHSo4rmQxjz4nUbnVsINxAJGD0wMY618rmeLqZjlfNiKdtlsn5XdtLP5ei3Pm+IMXg8XUceTR+60rxd7q62769VotltJ4a1LT77Rl8N22ow2hNvviK7Zt5Zf3Yxwu8Y4Ir1Dwdrt5afZNG1nUftKRrKtvErq5VX5+dsZOSMYXnNfP2l2K3txJp+gQZ+wPsgjA2BWwQUHTp1yD7V7X4X0XX/DcdtFb6WouTBLw4PylsfOi8jcoxx2PtXThMG8qjSrTbvb3Ff3r8uj2ulZr7n5I+eyrh2lGs8LjoP2cotptO2mqjfre+/noU4NT8S+GtUsNIvtPupPtZkfyIRgo6525bkAAdM1yGoEXItNPlgkXWCXmgPnFiFJK7GU8Ajk4xtweO1eh3X2iLTYnv53tZ1gMUnJdXVcuAQOnOAWx92uGstM8Na3fRa7rOjm1uY5N8F1vYIwPygZGBsHTGBX22BxmJq4SrGq1zRsuZPqr76/Dr56dFY8XifMa/1irDAU/3VveUXa11ps9rWtbzvY+R/GLXWh6o41DTRp8s1wp2JucLJGPmyqjp3XP3u3SqfgyGPVfGtr4n1eDbY3ivDJLjyYYZEUiRgOMjAwc+vFffdtY+FtX8Rf8ACHXypLfLtWV3Ii/eAc5PAkO324xxXmN78IpbEajpBfbZ4ZktVIBlRn4OTwuAMYwPavu+H82jOjLAziqc42tOUrqUGrSttfpbyt0PsOD8ypZnh/q024VLPo7pXWq7x0Vru19emvkU/gu68RXd5cWduv7h4jbtDKGyrco+cnKsF6fhXvXw7b7R4Vux4ntZJy6eQd4G3YHwVXPIJ68ccU/w1p9jZ2Z025jSCDmNsgIyZz5YPA3DGAOeMdK77wrpGkWHiGLw/ps6yJM0bO05/d/IT93jPrntmvD4qz7DzwtWSqRkopNJXVuXWya2+Xkrnt5jkeMwlGGLor9zC3M/iXLp1d9bP07JnN3nw/8AC0+mNqep2Di008SeUjRh8MwxyAd+fw6dK+SPHvgDTA82p+DLP7LCvIXdhGQ/e24+bvwoz0r7r+J2tQeEvt1ldqYP7QlLW00TM7eZKNu4ADHy8jHpXyx4y8Datrmg213O0kSadIpzlhh1GAr468/dx61+UcDZlDNkq1Ol7+sVtyqK1Xu6Xle7f3dD7zKMTCWAcsK+RSa6aaLXTTVaWXntY+GPD0epQ6tceH08oyxHfsmVdjhcnG7jjoNgOfpXZa54K1i3ktrpLQQTXcMrhBMOIo8YTHPyL2/Kr+peFby08U3dldWEkXnLlnJPBTptP3s884x9K77T/D+pX+p2N5qHm23k2pIkP+sZF+UMnTjHUcc19xz5jQSjS5U4q99NLJ+l439WtPl6blTo16kq0YzurJuyatH7Kil1262SXc//2Q==", {
    "headers": {
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/8fc5302fdcb8816f.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/cdn-cgi/challenge-platform/h/g/jsd/oneshot/d39f91d70ce1/0.4826650494440219:1767129763:VdSCo3QBJkOQ4x85Xvau0ByLiYSWQj6FVN5X6Bw0kJI/9b64d8431ba1e4d1", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "content-type": "text/plain;charset=UTF-8",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0"
    },
    "body": "P+2EJ3$T69tc$cGU1q$9-6Twxw2xbx5EABeE61xiEfq6sqr5MLxWEPq3Brxgxuux1LrDxLh67sJ7e6MMn7ex7vvxxqUxyo-S7xTFxAg28cbz33xWil-H$U-z2xQvKbwA2sqe1934f8Exz$aJzUX+xDOFDq7+EXGINxQY$L98k+L13wy13VE8soGX93ouA$ex-UO-LN4UxnuiT$SvxUE6-xxYRxAUxEad529hxWx6bLxxMWKeM$1dvi7t62x6IsPtY2fn3x1+D8YQGf1g3MQdrqtkv$7dPXetnxQn0Fe$-Pey-EH9DMfQPMnJtJiExt6G1qweNK4nCmzChxNcHeExiQCOeL2wJxE6YJ4RPKR8eMPosUVMTniSb$agMKV$Fmi-dhY8V8bIPiYXosx6AcTwATSvyEfRScyS+qKlcKmeKgCm7RKXE$kirELxchyPfF+kAUuvx5X4hniygITPsGnuLQdEUbI9kgJk$P6iQQL2xqY5mY4e7LlrY4e$VW4+-okg1-Gw0V8xaCD0vCAthqgOvPkdAQbtYGYWK5PV+fQ4hOdfKaqs7sG9YExTI-17kbMkzxnUi6rznaJK5bU5zQ5tO5Fcu5zaCbIkL4184F6U7kYv3+UulHYluqKw5vrxwhsoSaYDVsYHVzw0GClnlWfv4nNGnsEFQf8wiPKL5LOzIKtlGUcWAcGTQ8FBNOnTQTUr6zU$s1RtxeL$Af2xtsc13n6FxMteixunRyqQ7EIaXSNEBZOTlKeubJlmCTdFxOTyC096Gln8YzUXCeq672+F3sJMV6emxC17$q4SIx7uhXO$iS-5eDA112MtDgD4$Uq6+21J28RX$TFx11RhRE5ehkZx6enJJE$xDJaJLGCEF$rtcbEz4eV7+1atX9$ecA19aPtsmeA3792Su6tB9uMt+MxNmL9iE1TPt695s$IK+DvEfhi$r26r4IewAR2mas6aMuU31TaweboLLhGEqURS1kixboE2vu5U$El92P$6xxzShUSh4hJyi$+MtWM6HF9fhJzSgTSr-Vx933AbDED1e$REAec4cj2T+Ja56BAgPi6SnR3I+5+DBIKqF6yATDR2u-97392h3zyTMuaTAY7nv2JwGcrkwkP9US-teZ-NmxwFM26burxtrvM5e46cPd0wuxamuxET8REgRU3SiSV9UN+9Auf2-gZmd0VHjdYurteYAAxx3SeUR9FQ6I3P9Gkmg6$xfML$SzJ2lu+tvL7iexvCTa216wLFIJEUdExdstW8ah-lQ5Xe4fD7fzqBxoZxqhJBEqL33$e0mfe6S$Vmx3aG53o2w$AaRqc2Lg+8yLqN6bLRAthyA1Ql9GT6w9BZLlGhhLcixOMlGObFvdo+I2CGkw9XEDwtewIxqe-kzq0mqFhV-syXEF$PlIuKvBx-j2BQR5HPd7t5hMxwPUi3iv9zsxuGtduZ$Ls2bx3jt8dzVGYKl0P+f5ttbwZX7Vk+QK0HeF3LWvrUzGfS6nAV-7AhPGt5h0RcLSEfWte3dz8cLTVVHU3gk+CxL50Xkt4hd6hqUFjBQc+2uU3tJYZne0D+QuwgCHoNGWxmJK2A3yqskNlPhj7XeqqE3xPuA1q5cCHeLt$bAeJ1eExtmUEh5-xEKf9ECHm3noq90jgi$sS$8$A39+-d7I-xlSo2qiR11h9$rGqA0$ntj8HGdWNHLr1F5wGS9sLrq5ttvYhWNbEsxwAET2cEGh8afmyCoozzG8YzojYj$IeQmIUP9Axcscvn$uF1ntt+JuYBUR+1fj+Q4C1brr7STAkvEiU7Uf21b8hMqnxDz9q2rvfRVw$XAusyWM5QgF7UGANdRRQP3thJE6hwmyAA9t9xovMaURqP95cmKs6GFj73V2qvStz66ouVwZ$ixkinJ92z8Rh7t8g26ygjwfRj$NQRKQfx36I4zm69-fhwi9$7W+UAhQBrh2NPtT+$HLrPP7ODmgbe6u6r1gPTAmm6Cz$nr3nLlPGrS9NgcB+qTJuKPw7cl+1F$RJJ7LDuvyad3tmU121$U48YRtHChN+NcF3xbwcK2AetZ3fe87yMejct+A91Qc6k4WxzW5aGwMe4H1l96z1P5cMkR6rgIPgLEvEdzFKi19qqM$qIomA2B$Bm3x5Urec21BXEjBhagiqF6wW7uDY8OlMhuRMvXf+9tAedez+j5Xcfz5yUuV0$4mY9qIkIRz59xqfVXm3tK$PKLJEO$76ImAfD1$Srnx4$yA+Vdw4j6X0wOr-dFCHC4V7TTgBuCn$vdhAIudQeS6zg3$1ZdrwJoRCTa1S24$Gx6FNrIGsUP8JYmgrCf3YAV6GbrQzOPQza$I1Dg0gVRyaEc1XXV0aESTb-tA1VZmRd8VUvTcO9xCvMxvxryP17MrloXkESUKPfyhiQFyy17WyAzaMelyg7YQe8+3CCvFMGvlJo-Aq2PoqJyJaOo0qZmIBljYFaFzMB2ZkyJKOiTrnE7nC0ztGTeDHHiH0U4TCskGonklX604--IU1ltM5OMP8muYcX-A+LzIPWxrf9$JrPyGUtQJhiCUBv$53v4QGxKeynRyL$inKMiFqDEAfivG4ih1EQUYwz+ViseDRfwJs1JeA5vuTf91+ZX2AkYrb6WrawENuYkfPrrIQXSURVQmjrINrKRya9rzvZXM6fPS3VcrfXfKiHtfmAuv7CdbEPbivT7u6WtyawyU-QzSWfxx$Mwl17NAGiBZ+uIrd3teXlVzj4Mum$bt+okaCi6OblV2nJaX603LdXBbeqxxfsqHeICF0u14LMAxsoFRy$X9-+JiIWMuww1-K4c8hP$xiaTGqRmigTr0YOH3hKkCrGtWGzH5LE8oYlNd9$5BEfobsKK9W5JHJoa4E5V3hQIdTscPLwhVhnPxkR8ajazle4xh$Ho7nqWmNm51vM$oGsqPISOQFwkWbYb8NflLOWkbKRy8sdewbLblR0n7ITNhWlhyIZc0cvwtbYhXydOTfRQHFey9zTzDltIsHVrdSTIh4hnjoksgv1FLFm2y9MsoRw7syGCQ8VWaazrX6bQsheo4KcXQRwjESmYKa8f04cbvYnqvNDkjvaaBbwsPCCzLvTGK$qe$$rWrqyMdq2vO82LKWU$EKNSjY76EBzYEAiR7zNqtCcFOwu8KY6xHxEvryGT88jLwexxCgB7uQ0-A-0BdITW8nwwWhIrUWOmVVa5NkZWm6HSTjTv77iMhVFtV3Y8hG+M5PN-cWomENcIt1INkR9EDAmguywlHqe35mggiP-vxNeEtxWnguBwnORR$VOulzIO2EINKG+WUea3rEcfQLoETuTP5CPWGP0SY3Ht1SfeaR9xgYZqNagWLFaqmCWmDbLBbjF$2WA5vvOhqijwNYf4B44jjCo4h-+fwUoQew2e70D7ZdrRW2f9TYuy2y7wi5BngnbkgEGHFlzat4jqRqQAdyi82$wRwRaLaODkUuvcRy+VD8DU6zD44HDo5$EMGEikDEeG4jxaD6RWrKrMcctuv7U-v4rbrfR82MG54At3t2tntU6r692tHyiO$WcDtE6yHo4X5AcCHxaYxaGb6SDUwdDvPtDvwAdzd-6g6mR-c9doD0QcwB6DwHE6dQt-wSP4DdtaxYdzxo$56+t5t7wttE4+6+LREsd5tMwEietRwa$iwFGq426+qdd5qFcJtX64wPtJtdw8aoUGd46WdHt4DtwD$PG$5QtXwbDE3JwOu822ShTB6238woGh30U49vtq30U3WbtwvjwE3ZwrWxSb6xiDusUqS1WY9Btr6B6qPqaY3QUV9Btr9M6Ncw9R$JxB6c9N9g3nA69rrD9nAfGbtiW4D19zPA9iSbP199E5$k3RSb9cSQtaPlcBtaP+S4Ha9rS+taPXcGSu9itbta9w34SBP$S5SBPGPcE4tCHHPbd4DnwB6nd+GQtFPJ9B6yPbL6SQ68P7SX9oHZH1DBtO9uGZHbLwQZLBhj$WRecJE7xqHQtqGUGxKcRAq$H+KAWxmvG26l4jxZtCDbUnxTGZHqaDc-33GcHqvB6LtnGbtYcb+IGfSCH1GFRvK1mLGvW5c6GQtic6T$GzajAsmbmMmzWN6$mBBZLITgm-3JSjGb6zqPGtt4DWGFGZcCcKcBSWQdH4m6LbtdHu3lSwDW38SwHKSCSwDu6LKXSwDSSHKZceTWKwDdSlKZGP3rKGq5RQG7SstPQ2tbKPQEKLmRKcTNm+KCHjmHqfKnmVWYW-W44CDQKRK7S+-hPmmU-1WFmCSTdIEFHvQHSX3-$lDwidHIAo+b6fEY63tTtm6CHM$9LcLTLWRrBmFKKZcwUcDmcnmKrGu3Bix-u+2zRv-e-HL1HzHsxcKRF7D1wXSGDTPKxri5QzGEui4TUh$XuPR6Fu-7-JAhGqayR$dcB2SyeKxzaWF1xaFakPEgURxVqKruweiJ642AkoxHGR$2xx$I4D3F$1gsqqxdm52h5vJiADyqiTrxV72a2hg5$9P+ADT-fixJL6JhbPfDBE4R4LPsMZ8P621xBEibLbfbxjANMejEocwhTumEL0Vsg1$1yY93kEJW2qi-vU66FQME+Eb333G41yeEl6H30A7cBgMcbcrUo3CBT-56$stz5vL+Wq2evhz26YikoxiEW6xh6Efm4SW9bujCKmPwPnfZ91WXM+Q0L6MdW-JyAIyEicENTBym$H2E$VvhWtV-cd1UKk$KjqU5V+c1iZnL8DrIAUV5M+1QQNjbvqvSta4JVGjE6mTOMT-nq2gDcM4fA7jLfI$nOiPwO8oxTeRzQzK-5KJr1b8qsUAdjJe29lQciIggxoz2Jdqtxhxxi-L3LRz5btfXF9AinxjKA6z1csgix$n88Sx6zAqP$Rn6zaDnwYkbq5wcnE981YLuw39ON5A4Dt9cIGBSTwnO7cbGA$nsnt6rzS67bUgGD8ba3x-xTYhKJ0Tx-5Tc$tG2cu2dwSV3Ac$7$5r$9x9tefL-7GTu7OwaIwdE7GwSNsCE$CNE3s75n5R4$Xma4veV37NA3E7Gy1JnAtW5lv3Eu-rRseOdM3rxkXhirSP0Eu68-FW1N8b1f4vkkOEusAjvaON6QGv-$GA$$Cx6LGAABXOFDaxtLOdEfXiCh6BaBCq716kAI5nx9xv5NtIYqOOFc8M89rrA3GIaxan$bf4O$x4souLaBRCu6xU$Hb36d4eRSbM5YbW4$rrAtKW82dYGESAx4E96B8REjiCRMXhUf9B711UxJe+etuhtzxRX9SNrdRzK152k1Udb4XKin8cSqRSYqPIYA1KG$ug6XoKU9AdEIvhSb1FGhABX$81AJaxtlSJcuOstJsIxF-r5hCFU96k876C5CCmRGE4uyCCYyO71E8EtyGJouX$tlU8aG7yO$te58U9x4rXslGh6B1T88Cx8Etd6XOXsTx4RoCoax6oYCxNOmEo1QKXax8GCrtx5XOyU95fCg60sfctC25lgu7+5WU0CzKwV38s1tnqPPuUVtRPrI4q8jYs1Dt1$GraOYuTdTESYouy8ZGU4FOM8LSt3CceylkKrB5$t8Sxb35O7eTB6YRlvb6CchyIrLkhz5eox95aEM3gFN7b$sc91A8xT1kc1A1Mt21rGh8QaS-6CS3OrVrs5h$IwusuYAL7wI$Y1$xou98AOGw9iId-Gw4VrIKBGPEU52oHRztU5T3Pchv$kxtvqwL$8F$uuVrgx9tDtz5urdSzSh13AcWu3z6Scc--axxTyw5KCyEYu$SD$z5ntwKHSzJTkDyDjc57-+1$cVCx6k5yEtdh5DWnt6ybw3LDgda8uEEmUcW6j6LmWw3-WntX26V35HSzFUYHavTeVnKcLnWYRPr602sBsvjmrYLaScM0S3$$SYWnqgmzWvyh4vhcA07ruht9$VFmjZUU5sxqvTk1yPr45n18b2VYu8YPaPU7j7zktI--oiaSFvj7jlf7--KW1-xfVRrAKbWnAKRYS42sMJUD8VjDzSu9$tOLX9RwU7SgxMTSEvx1y7jDqfcIW7qU87TdXxbHs03KEMW$MSEU6WryY$j7TLu9$GEsLtCKKwUMWVMteiWnxRGRyhUMqRLYX1LkqyGNM$WnAJXs41X1EMWe1RTZbw6QMnTjVNWbuoJN3ISzrIEa31U96BT8icPS3KsLkG3I72ozSh82vUiZr4xv-qdytVKckQLx5l2gWLwwSl3xWht4q8PTy4yTOdd4TcxvFz6fXVcLSznLidLPzUxROBWGW$5r$SrrtORdyz9Vu775TBjL8eJNuWEJ3JRJRSkAywvxQ75EXmr3RAzcW7d9$CRAzysCCIcztVXOwbXX8bARJIKW6bvcuKjVr$SlRImR2JjKzXF-V3zuCJqbECLX0JCKqbXc$YtDWKM-t96A1QGh84MSJQiKMlzSn-onMzqY5zyOgLF6uvklz8WIWKygL4T71RYorz5U17xoWoWCKYxY-nXljJCTcFG3vz6KR3WnhozKEgLjudYfLYEOWqtHzOMljfymRjSHMOL87jTAmsyx6yt9qDA33ZTkUgSg$fWRKfLYrxD7SjyxN1c2W918yBYZWlFtu$3ZTeKeLSuXTjLYSeNeljTzxIG0gw8YXhNA5q$tUsA6-r64zFG0LYxIOzTXLe+Ia4S9WRMCXsO3FsLuRc765$us1Du-VGU98++QfHR4LMS7rge-xjLxxr+giwb3trZb1D5bu77trdEv56tdkG3vliWvIrtZYJGWb68AN9lNRMu95PLqtcxBMANSdbxfj9HU8PmjSRW9$rI7jeSbtQy+IS3rrI8RrvDidTyEC$P7RJyImIX6bCXADy0ssg1qYJYDACyizae6325cImN22RmSdDihgz3mDF7$r++$3FuvdsxIr45lJq2YD4xtLYDYDbjHSlr3uYNXq7EDDYZz+g7AIIZHXNxzD46ZyreLbzv1N1DTzCPII1IKX1IKERT6m7IJYIHsAr$2n9SjcYHHOHc1Hs8AS4YVHrIbHmGbl9LwAID41N3+5b+-5bNmZ-4bDYD1Ddrk7MNkzgD45g8EKhA4tmROrV+bDvDYBMywWAxGEoAkug6777BIirxEc1HRBb0VBnRRHshsH75BbVlGSg5Y7iBxGYHSq2A1DGCHOTNozkBQIAIkBZL7g3r1H9yHXdVa+IOaHEXhoaDQD1Iqa95EuN+v6S-BZRDgHYZn$wtwxsH5Hw5C4YH+L9N5DYlBI+t9SZT1lBZNN1OuD4tujwE-5y54D1DxIT62IkWMDdILGYEPIz$Y8euRLDhJCPIGIacGHVHb-qaTxdD$N7DS5VH$nq62tWHTt1+W+kBdc+EHBiIkDStm63AGHt3264NH7w6r5SH916xBLKI2tuDHDSIz5uInEWD4$au9iq6B1FvGlPUD5uxW+CD48JHaED6BtCHe7I8JHr$XAGIi$vNNMhhlIoRqtxxtZtZkDYDSA5iJVt-$1tul+38Fr8ItNF+NDS$eua2fELDgAGB2M$v1h0NHVhMXW2UWIWLytol1AGHJIIw1lNAZRIcdD1DevDtO+Y1AA1D0l2j0I2xCB3Dd+NC-vBNZI7v1SBD5NGo91aaA1BEw3bEltCsKhN+e6vY0GzyXxQMBxH5eTxr8UBK$BBqlrvf6+2EQBnxknMLffQuSFE1A6NguogxLJ05+h6e$NxNe5egu+v6I$tuoSXEfI-xk-v6Bo82quU8ctBxyG8hQwrHa96N$GnVe3efh8WTt27O6xz86Zlx6i$rw2xi8dEAI$Ym2xGESqd2LMvy1C7veJUhhAkhH$gWozEqnhmr4iVQEaI1BS98IPT7weKVAPVzmbt49SEZY1lK6e76L3LKoa3wknezWU+oERtt+26CtxZ$yKoG$wdT8F+17D8v6nA6Btb6ERce0aOA9m8FBUR0EXaYAgm5w46YyAMtEkkk2Lwl9gWjXuexBq-TQ1W2tH3YbY86GRxyEZEOvfwmzilNH01ffv9kRTxMbjJoxPv9I$lqMbMhycRXvrzt6sxM395SXo18QPbqKEghL2brLA$L1anM+xo40y4tuRYhIsgcnn3SvIRmhl26cfCR-9z+deOqywJteExJRMhviQWAcxWryRrSWgUTQS6SvLR9qVtO26I3yxlVMuTg3DgN8D9JEHCjUL2-i6nkRx4hBUi69+KvTKxfMKqi6QyLsEIEQEzS3Lbi51Rvivhh2M6g$txEBnfxznX37xyIehI7cAb7xP0LUcJ9N35473b3YxcexYo4UKU51EOvaE9MVqQ9gShlcen2j60CmQmi1$GILCWsfNVtUPrI-Fxf1PSA1yqqCE9UrU2QmcY6SyA9+oq$bkMhJhHU8F2I$kh8kI3crfbxQa33PA8rKi$UOq8Vk83MQ+cdUUtrW$cygTHEuUY+nq5P58eC1DhtwT8mHAbSH$5xv8re8QmCeax9XQwqWtbxsteqwqXlgh0nScT8ikUh9TIJb$QSXxO3$9vW6ytBrdmsqkc1FwH8I39kUEMRtUtUIrWZiC2H9K12C1giGxUxk-$t4C553$i+2WcjVQNFRSq1xqccebP7KWS$kfbn+JJ5ex9REIdXvhQudL1ZeMbtg54OOAgFRrwUA5o+$Dn+zM$OEcQ5c8ggS+YalRQTiU4drLy9GQk$EeDTeVf8BrCkbs6636nUt9GlkZxqLANQ2yZxqsslVhewh9646q$8JKNrPuMSZ3h+BO4K8ggMxL$+2M61uRDhGYbickCwJAPw8OCZ3rQ3WQEu79KYzcHVR386zB5uefkrNuE0x2igCS0H7mO363La8e2qeEejqYSXxi4zwK824Jqsti9huTKrkXqI2ghFEeTGtg2xJiOLwTEOTVh96vmKUkt11taqD754Yd4l3LGGImrOza7bu3YBEEchjEa4m4kDKPQ44q2x3QunnP+gGlo+eaEz1zK+ABrSH7-9MR9AFQOKVHXnFctM9yQmwg-jgd0ygKeRGlQDWLPh$Nm41GlK-vUd61nmWAD8enVIPA$F3eaIvQD4in96seAawvFt3Qg3ukKlxJxq-s59D+sWhaArs6narvL2cwzmDnnjxEY7i3q$3S1KUUFJaPKv2CqjQ$hPDrIQLrcvCFO5JtSRKiArE9xa2Ree3KLqjSPEScdTqhwaxCAmg6mJxxcTZqy8zzW2t7u7inE$E11aXkD2JThx4$owVw7uq5ixeKeLbAuRxtmGhATGA6uWoDF4h+kKAIMSMXs7ze+kFw7P6Yd1EkaAAb6M6iHJU6ZKrAEwDigxmrKfK$AMjW6jJ16UJwhxq4$us6weCKdqLU4LNOJ19Y225xiCM+fTAIxem9sZvNVJWAVq1Q7x72E-TKnBxHcs-R3M+JW6m5vF-zVE$7MFm3yKdyUQOmjJ+eBuTRaVSXo7zP6s3DFTb79jPuKfOCseOnH9Crfifm+VxHxuBPs8H$uu--76kAE7Eq5uesxRUlOz$3HiGSz-6xscC3JEATxZParVcZ9EexarYG7bjSm-4etqJbFmE7F4EPg$hFg-VbCc0VulJDz0cZLuFjCcUQxUsF+sETCHCovIeiF33cQAgVwSt7k6FRATRaE50EEa-In1TuzS+6FX2iSEfMelUXJUYtKB$nEubvawt7CTVxuTsnLoQm-4FATldMDrfhKXM-9YW-msiw9t79kWcDTI26lJa1VLxBJFqMmYJluzFOL4Sfmcf9SqVLsxifesWlP6$w$fa3DOkGhF9igG9YR35biO9T3$Fs1O0VEPWFoXMRSz8TwNLI6Y7XFe+Oh1Nirxf+JDoLPfegvb1qxw$oBov7Ny$x7CS-FL0cYjYjgBIc$xBBePR8jnjXM-qzFYxsLxCDzu$YIaDlIoeAtuBHv5APegVAdLmqJBDDZ9sWlfPreJD5UKnOXxGkqxS0IETS$zj2EBvnQUie+e5OJgAK-Z17Px8ceGkyWejEu6wNvw5QBAJeB0chgqvhonG-Z1P-Jq92Gsi3-HMaD7BQ-Rzi-Ja3-PqiLhuHu-JgAh3HiVeYqVNBZBjSVDTZdf7gkLcND+kKg1Kl1JD-jDrx6l9m1$-Xkt3EnE+CaEGE85OEoiK87dBsQP2201JusPGEnqj5Srfkz+bDVjiY+U2mmzuJq3iihu4T9Qq4Art-$TaQith5m0z3EmfqmmRe6YwJIxRruQ3Omto8-V3$ruET9EAqtXAeWlInC1ay9KqVTdUq0PzKskSYVHaiLjwK1SatY4vwxRY7J7SQ-Baodgr-T6JSy6Tz+D11zKgSSGg3$aP6ayCAx1rd$6wkNYnC4+ys-elvL8Lz-V7227bVokC+5hfLVhx96F2CYHvmn1hmz6McoksxQA5F8mSYhm1u7jTvKQx6WHrEnCAim4tlE1$jue2MJrzw$oERLY4-A6Y6s362QZE3We1nP5qx8POEIx7Hx6sgtmxBkg89M6+wTShTx4X6WZc$g1x-WlIRnDVO3s3SODx4Ue5U8v5jS9xm4PnCbcw7ArqEVEFnDlSxJLo26xRVXfxty1B40Q14JeLxWmaz6VcqAynUvy-swB3YRiTYabYaSLvXDL4Znc4mjF54$vIrf31f1-YTLlxm3R3f4eAOe2ViRE0Cy43x5PVYh4VdYZmJ9XdriStqyvDIJE5VoEErVPxLa5l4RiQHtq2$8hQ3SX5lm$Vhwbz5jtwSMGyLsl568zRoRkKEd0Y85Thtk4sCWNOyVdLbRxYq9swGYGGtESgxxkeq8dqhX7C-KoKy4i9JLJg47QnGXbGvPb7$VAxETrI9z-W23PVlE5zUhzHGTT6yxlK6LzBPdvRtx6RJtAR3k1TwEO5K3C4JxADy1dkI1hBdNLPou83oVG515uuy12ug1$Rm04Nqo4OPELhAaYmic6CC$6VRw4TIuX2IACgOQVCDh7FVb36SO4ZeFdKova5MKjoBEMbTThbtNOhrdhFdvEdHjNYM$e6tUCZyPj78+lVaNUSe+1PNOF6a4ePNIBtLQhvBEzugQIatvaFeBNHjALIbg9e7HVavTPV1dNf$8I$AynPse$Hj7AUdqzKDUETSVRadm-vhPg17K7MGq0wzxsZ2ctoaFram$MPLIcWTh5e0wykPZLAKqRcAdyHbgCqWUWfuM3iekPZr68OTrAbZiiPNqAXCqED6mzFdN7ObgrsfC1zj6E9jtL1bCRYzHPRvfJ9wGwb0$51F7rZu$CziXCK1$x2FmqduSDTNzo7bV13-$EomEGMEz6o6Cx0MyVYe1OFoU$uR9HIP07wzQ373tRzyLKx9MP5U-L1$XP9wstO-QnSByaxaEvOEh7T0mGqQTAoFyT1grx3APaIZ9f4cnSgzG4ZvPCT54Yd8-m9FmLFqwYcLj3b2CIkCvRczVWJXPlYbYPRCrdUyG+umshQPG3J8CLGH1uco5Cz$iWqm7rQUVxxDAbhSeQUg6S8X-A43GxvOKdziOMQNCBI0EM6QERJXyY9aZrSHYlVDxn$d2l-oGeVXnwvx4VObuNrdevxA-Bko25PQc-UFZzvwX2SJ13bxFZyC58+B1jf4ERITtxK+0$Ae5q$j3BkEvEifHg4S8nYxgY2CEIrV4HmRd2xQDeBnMEIx4Vdg-Pc91Ar9I9VRgEiCSYQbIwSvU9LnK+i3VzegWxSz14KYQ00niWxS8FsKc5woxjgIgbytFctJ9$E43onXqCCPym$dYHgko4CswClFFaweWyMSOYRm$9Asgr9oPrRIutuqj$mj9+12lVlNUieury$GI2T6xuqZq56rJgyUlRxo9th$lCWENtOWsxzN7x$8C8dsE2q7C1k$-IQBXUVEWJsSUDtn5KxgOVa7FUsx+WDi+s3+2TaBdAl9Wbg7L3x6Bx+HrV08oI9VsREDhudx94M2yAZSom1HBzYRf26QoNCYn-A53K1OR32k17CYtOo0siSFeVxuMBdqtAie9PEe6ne$A2AqVHU5GY7zjVW6Utmcw4b6geKm9R4$BBUsbJjM6AJEals$PT21qbt00l-NYZ1Y$rDPf0I6ADQWyDm$VgyikqvDEzjifGXw5afqETMbAmrcYYLfqjNHYjLeaeZI8qAr8CzirHEJdJUr$7zozVEPsWeqXcekVJaegWUDacsSbfy$F4BmDHq$rRGD5TEAl++oc9MAeMCRIm++I$an7k6czfiDtb$cEF17aUJESVXcVZVxWO0w2uYU$aEbovH3KJ+beEJH7YvH3onwIxmFb9OJxtRx7h01fou2jGE8xbtDfQed3$v9QTKxD$Zqal5Y7VYHtF4TgfyAi7gkJUdQKbnqyxUtWqg-$rhbMn2tw8XNGRcx+S9wfc8lqtPJkxxTDPf93xGDdyi8$2kt4xqkFJanPn6Phzu7HxRwjdvH338GmDiagPSAja98P7VaP04$S-obhuLShZky84GRaeWEoC$fvhv4$m$OxXEedPfvkrf-L5n90I2HsdQe-r1bMOfXsaxtG1fb9XnIz0U96H1j+gRlHsSQxtTDFvRNUP9jY71QlEaH9N+$9T2h3mBSghZjWA$z$F8r5zkSqD2V1grLdS52nEd3QxCl1menDZq3TLr9kaRQQkXmVcLwm0Imt3SVZL5AvymGtSu9Cnjx7uLIQKAR34+ke75zkiCSg3y+-yO5UJ1oS2Q3RQ5tqu-3sYl16Ozhf2XTKoU3QYFy94Swfl+HGYQEr+MYdOILHBh$R730fEyeeiGDTgs3Osmq7kQnzwU0khiCnnnnNoLE2SvYox23IHQ+KOmTbo+H8n-6eOzqAWo8Ilgfwq213y+lMi5q-A5dq2bPLZ6cHY7ibqhMPqmc-A56QOm9wsBMELTOw92DXA3RY9qikK9b9zqoYJiDz7rJIQunPPirRYHHgMVAQ2FZxkEYzEkYzyGfHe-IRMCDiqwI$cY4k1NzePIFH95zj1Xe6BSxjlh8r2d$GT+5o$yxVk9AdTJezzXidwx+Fshyk3kkDQe98UbEOIJ1TieQ73xYLbd8HtztMiMrwCWZex3Q95U7S656Wcvf8bhae+jVJQLDa0d-QCct-Bh1dSh6dXQHxWMT348u1Y3BiqDrLL5iRYdey1QmnNuKK5UxEDzW-m-Juf9PWnuFqQEA5Fe0fBmeHbB07OsMan3wWFhh1aEwd5YLmFFOPWIm8GlK6lh4d-zi4aCPXw-GLH9uqkjGtXwFgtlB3rtcWbdjmIF+Q2TBZaYg2aLU+5Ncbom9aeo6zxgAdYtxUrGRIAO6JzyYM662wdFU9qcU2XhcmXsKV6xvZwF+lD7HEEar+moeEUUoWcPSohO2xw+$iVKKQ7AZiLDnsU7JXm53B556xdxbE95skPg2LixE3vInjiggPAOER1LD+Imbx8cAGYfS4SMmbVzDUYVmUi5rmBaq-$7+0H0MhveB3kg12v4GQlU6o62PRYyqaud-PNLCEbo2uahwugLjL9PP1iiubr0LLJvH4zi8ub-wBMCRi3ZJnLNqz9gxzVQSJFxVm-tFzEu$lFC2-FPS$nrh2x7hubKCq3A608Rgi9e15iMABckaEArUSEFSztA$C5UakN9Z5j3nTFg44S25aWrIdLiEjcqQXgdGilSeqV2V+8W5h$WVse0egkc2yqRo4$xm-OY-R13Cz$D3CSTzh5WVPPdsCZBXMGdjQK-x0c6dCrnP8jlF7l11drzDwCbc$ihqSr8S5GT8yf9F7kMOYH6rvSAxKCcv9I+T-59fe5FO4lYFWMgOKRqU9RHZuqkjRoo0CidsIdHy0Rw$GCJd0zbHzBxZoFCaL31--FUe92KqG6icmZ6789rLmjE8Un+OtgwUYr9TqO4STyoELsJMW6rdonV4qba1V2i$frE2thmEg9Mn7+4tmRNXzyME$7HPKHPE301XejT0IWueShj6gdNkXFMz+N5-WjaFqBJj3zTEWSBglMuSMusdFWbmGNV059qv1VbrVPcVJWSriZeWyGb67hyzuaRD7EsrWEz1ytBUGXvjaZV0IWgxbhcydIZgGF4Wq7boyBPHb-YbWcg1eFcGFUfbTbEezNzVPX+bKJHfR0BCcG+bB8jfPNX5ke2Kq+JTK3Ieiy6Wd9rXLb9abQyTvOwIrWBcr48tkRjgl-bs5qbJ7lPN7kmrLss9nljF99IlKgzjrhnkFmnEdWJwOhVluwPs+4zeyv2mHFWIGt0q-$Hbg+JdeSj781bSnvSoIwyV$cZBGtbq$1bFeOjCIvmz1n7Ia1OjPUly4GmCqxBFT2wYWLu7K$BzgjiRS-dib9gaimL148iBxAP6zD+$qV+cnKSHEAVhiuXQoXayA6Fg6mbdB7RYNb0NBLk7mlcqzHj6PXav33egIqXYOI2Uka+P5EawvdUeiQigNnJDXzjbAlcEullmigqXKT$KKYwSjUM0yE2-9d1Jefxo8vjv3yCA8iF2L9hAB5tdA72-Lytbnxexzs47QT2XoQ2zOcOTg$88eGIv2D3EH-IM1bABarzqJ4tlIQrEGx9Jbkb3a$QErffc8Py$IyRfRvFMkh-y5lO7k9MOvoi-cavkKg6f$JIy9W2eJ8SDyUPz3IhZcHJb4skIOxNa7Uo89+Pk-ql9+hY8B0SunNqHo30-mi0vjhlaLDMbgZ8uSHNrANABVakg$4EE8FF92Me3InKGQDdqD+ag3C8LrJXrIey5oDSy30WSlhNJBgukBKuQDoKw6DkVsGKC7fvIMSfDtRPKl2$F1zTDkVX-KFahetYTHfF2V2gP3F3Vv4gsX09$akdt7$JJM-jeHwB9b7ytvxuzSnLOHMBrB6i7ArJMQAP03$Xd6$S8LZ$xqv8faxbO$4ckg4zY0yEuF1XvhiIhKfvXMuLYHHi7kffcXcA1KUDInWhhmXCS8BZwIYMufeqEJ-aDv+nTZ7breh$nYvsmoOhyTGr9E6QoORWqhWw9ek2er8KOA-+6EAu2BzhLrP0+zw56cm7B1s9REMzMR83lQMraS7tHX7BmlcYggsxaMNe2bRRTL$mHUF+Ngox-x$G2XD69sxGiD2X12KhCG7znIRPm$uFhhT4FqrVXVUbo8JdxSPSuyiP9A3S9s2xPEEBWMAsGSTvm3sUN52tlDj2J6XkT6lTwzDeqtyEsk1sywQCIGniRvKe+8oqgomQxjcKGrb2lCc$bx5PWuhTv5N4Zq+nq$l$iUrGKRCo1tjckoHvysU27byEQvqWHYj55mTOSVadAudidBINWWAaJoSrqov9xKaJkX7LDimt+$fgYqD+FxvGkRiQg4sDxdyuxEU8YxCrfu7-QkB-vN$yCRnj4QQga1rJ3yWnNrM4mT38TL$8gUl+qggHGxIsv6Xu$BgzHHj-l$wYMPA6sl$BCsbgDvb+Qs+6acitGF+qlz+d1m8sAnLRA6sMH1V3xU4FBIHBDxOWPrG0c-L+fs+XjfOWbPlwtc+0eMkrG0lldwoE8wqZsb2eACNUs+OTwl7r9gdI31m0T6Ff0GlCHXgJxHlv7U8yfx5bdG$$UmU9lsWZA3CQ992qR8hqfe-DL$dTfihthJELlj4iZq05o46TEqNSYClrBGI735qH6S0gmPrBxuoVdQ2AYc-eYrLKit6j3fR4jMUHxArf2QfEfqe244rZ3jysrXYe8ibwtnjNfYXRK+4ewN-j00nX-j95d8-t$kT0mbU3TX5-CkBoGUToANGah9+7BXMbFkDADitvwf2hxY37ujku4ivEdjwRD5iavT9tuw55-T76HwMbH+1VY8Fm6H9k5VUounrDf3Z2cUOJsZYJ3v3HQjQPYo-M2S3qQBMLo$ouR6O7qQ$aC5zKQQ2PotWWlfrA-AB6nHwEbjrHrukCBnNzH7T2KE8fLJKrfvzGKffdjP2eiLPmUkmhd9q2kHqU5xNvEV$Bf$t7H+$q-+sTSc1FbU2h6sWXZ9aCAbtxqWGZWCB$MU+qAfNrGmJC$DEVeKOfY5gBWHI3eReCkP7lRjL069D$WWcXXDo$WZrxTcrrXTgm7tOHeM2$vUlAaJQDTdJn0fFZ28oEADNh46UXXGOYh$2kEZ0yntAB2SB2hOPUYmVS+Pg6xBteZ3BoXquHlixdj7uQfFcSiSmLTIuzQ-iz2BC4CjO$E7G5KPKlJMwZye5kJmx78UEXEaI6q1urq8$JC$$j8Ll693MrUXRb1wu$92Y8RELUxx$nPxD6t$zhEhz-aQ$2xQRe+J7oTTG$f$t$zrU2Kq9a+Ktem5EGtPolvuPN+xxhEhLexC+xxvjEzxPxxxtT6OlXsGE4HSxYhDxgA6Oex6v6OuuZDA9yNko-xqLxJxA1t2$+xKOwR6lghxnNRUCD$o0nkjRv$EZz-61n25jJexHeYxM0Do+WD9d$xjcmfH8HSDjEU2EhVanKJkhQEOjqh800l+tD1Etj-m9+5rR4xLZVxUrVOdIu6we$Gj4xool+t26iZljKOu0NlDHH1$OjOOZ0w8BtZVUhZLc2kaoBSHkNAZmjufFhtKHHNcZ6OXfFC0FN5NmZwZcOkMY0Z4NdjF646EN4h$CedjKx8eJJroxQEdUbxJexx5UsCfZua6WNyZuPLB+nUn1Rwxtx1ZlcxX+A7BN25Hs6$UNBoXXKO+nUQ0L0cW0Rx6jEaRnCm0-XZCdqdxyUJZ+dEbx4VUoh$PujSdUEz5jRPAb-anEQEGBnNmsxCngY$gAjzfDUQEXBnhtjrIUQQ6SxZBx76Jxbxy0CWeG+nE6Or-xPx6OrAAnEx$E6OcUt2xrx9UthxrxJR6jEf-1Alivr56WtMUo+Us6jEx41AER72r$A6D$O9Aik+$nUnxe1hX+PqKEA9CEQC+A9bn1a6cx7E7tYEyysd2av11rT3Jx6qxxtAZ3n2aq$V+29tXrDvXPmfr+K6NKOroxWNmOr8EnNe8UcEe1$4E1xf26ZNMUJxtnxUEQrAMx4q1e6ZN1x1E6hxOZO2x$EVejh$0EDxf2texZxfxxxxZ8lt-xxxJhMxxq9UtYeIx9U6ZNZxnE6Ux1xQrA2x1eVrAqxfeiexMx5x$ExqxYx1r5kN1x6e1R$vcsEF0x-hxx6Nzhvxx",
    "method": "POST"
  }); ;
  fetch("https://grok.com/manifest.webmanifest", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "priority": "u=2",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "sec-fetch-dest": "manifest",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/2a2cea638c5c4dd5.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/12df10b766c13ac2.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/53937ac91d9a394a.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/0f587fe34fc6c5f0.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/fac431ddfc6689f4.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/daba7f6b22f583a1.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/3605294adb7a2700.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/suggestions/profile", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b6d94f8cbf53d6c4-0",
      "traceparent": "00-4d81b19be2f8dc9e23e383280f610745-0b5f3fb57854c1b1-00",
      "x-statsig-id": "PgpA/e7qLxU4kImAh2LQt1Pr/44Q5IvHKrWim/W+sqyCi7oQ58Smr4kIwkNr6moDFEbXOjvsICyJgVlRhflmwpH6vORDPQ",
      "x-xai-request-id": "31d50acb-24ea-45a3-9705-7d5fbdd9bd74",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations?pageSize=60&filterIsStarred=true", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-be721ff49edc3378-0",
      "traceparent": "00-21e4f1b6b147b7de055e52887dc8995d-84e054a09cce285f-00",
      "x-statsig-id": "+8+FOCsv6tD9VUxFQqcVcpYuOkvVIU4C73BnXjB7d2lHTn/VIgFjakzNB4auL6/G0YMS//5uYYuPlSvx37uJyWvCe7nL+A",
      "x-xai-request-id": "a6dac62e-b859-4e0d-8c21-a2789b5cb74b",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations?pageSize=60", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-9e1e5e7af40d847e-0",
      "traceparent": "00-89c6f5bf1572e3029d42243c2fc84c40-e2d9d151064855e7-00",
      "x-statsig-id": "69+VKDs/+sDtRVxVUrcFYoY+KlvFMV4S/2B3TiBrZ3lXXm/FMhFzelzdF5a+P7/WwZMC7+5+cZufhTvhz6uZ2XvSa6nb6A",
      "x-xai-request-id": "5cc0777b-3eb7-43f5-801e-c19c7046ff03",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=tXo3l2zAeHgnMUk2O2OdvlmUIoCZM89RcOVXVinqgAQ-1767129805-1.2.1.1-UOl42l7F0TMyeaAWyuCAK5os2rRv8jVHSN974cyb4wwB.FO_ZWKZQIU5fDdee2gHUMeeFw.AeF0FnaBJpUawO8zgrmQiHzFmfZDKSY3DNDNFs21kw6eOqBmCedfVeRYR.WOhwyYMLE2aLsFbt1HY_SwhNJVUqqjR1sdHOvJ4_hplq1_ap11tXeyjeQDg7dFvWMKUGR8EJ7NJe2oKZvv0SbV7.uBItAYMeguBuRJBqJU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132391$j60$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://www.google-analytics.com/g/collect?v=2&tid=G-8FEWB057YH&gtm=45je5ca1v9206809855za200zd9206809855&_p=1767132392111&gcd=13l3l3l3l1l1&npa=0&dma=0&cid=83069579.1765227275&ul=ru&sr=1920x1080&uaa=x86&uab=64&uafvl=Chromium%3B142.0.7444.245%7CGoogle%2520Chrome%3B142.0.7444.245%7CNot_A%2520Brand%3B99.0.0.0&uamb=0&uam=&uap=Linux&uapv=6.18.2&uaw=0&are=1&frm=0&pscdl=noapi&_eu=AAAAAAQ&_s=1&tag_exp=103116026~103200004~104527906~104528501~104684208~104684211~105391253~115583767~115616986~115938465~115938469~116184927~116184929~116251938~116251940~116682876~116744867&sid=1767129805&sct=22&seg=1&dl=https%3A%2F%2Fgrok.com%2Fc%2Fdb25589d-470e-4c8a-9327-d547f126d1f6%3Frid%3Dc50ca230-f229-476d-8990-bcb992893698&dt=Grok&en=page_view&_ee=1&tfd=1576", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "cross-site",
      "sec-fetch-storage-access": "active",
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "POST"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations_v2/db25589d-470e-4c8a-9327-d547f126d1f6?includeWorkspaces=true&includeTaskResult=true&rid=c50ca230-f229-476d-8990-bcb992893698", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-a5c7c94b2e7018d8-0",
      "traceparent": "00-2c54f689df776245e481b1abf9a5685a-993a7f1aad04fb86-00",
      "x-statsig-id": "BjJ4xdbSFy0AqLG4v1roj2vTx7Yo3LP/Eo2ao82GipS6s4Io3/yel7Ew+ntT0lI7LH7vAgOIuLwL/oVVRDU+eCqFLK1BBQ",
      "x-xai-request-id": "dc7bc9e7-c26d-42df-833d-084df42b2fe4",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/vs/loader.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/api/oauth-connectors", {
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-958103f1bb90d631-0",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://apis.google.com/js/api.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/b02996fc81e90ddc.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/workspaces?pageSize=50&orderBy=ORDER_BY_LAST_USE_TIME", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-97becbb02b14fc5e-0",
      "traceparent": "00-f0dca4fe66a827e39157f1f378581794-3f7bc184d0fc5d23-00",
      "x-statsig-id": "UmYskYKGQ3lU/OXs6w682z+Hk+J8iOerRtnO95nS3sDu59Z8i6jKw+Vkri8HhgZveCq7VlezojwhoBGaZgbNQjOSYaySUQ",
      "x-xai-request-id": "e0766e82-f7e5-48ba-b808-44e753a1bb92",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/assets?pageSize=9&orderBy=ORDER_BY_LAST_USE_TIME", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b542660d7f4c977f-0",
      "traceparent": "00-7540dd1d8967f0efccd0bde13be82a95-8521db89a9e7c2cd-00",
      "x-statsig-id": "g7f9QFNXkqiFLTQ9Ot9tCu5WQjOtWTZ6lwgfJkgDDxE/NgetWnkbEjS1f/7WV9e+qftqh4YHTPLaBxxuM5XVpeR1vo4IgA",
      "x-xai-request-id": "3511d3a8-b449-4f6d-b5be-dfcddd4f4b82",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/system-prompt/list", {
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-aabec71fa2680a09-0",
      "traceparent": "00-bb62f4ab6f37382e44ad72e76623037c-21e6e523b3ae1f9a-00",
      "x-statsig-id": "+8+FOCsv6tD9VUxFQqcVcpYuOkvVIU4C73BnXjB7d2lHTn/VIgFjakzNB4auL6/G0YMS//5fNJ1B91Bnsda7e/arfmPZ+A",
      "x-xai-request-id": "51a96b6e-727d-4b3f-94ac-1fef21390972",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"pageSize\":100}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/rest/tasks", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b8bf2cc9b1259059-0",
      "traceparent": "00-d7abdf79ec0354677d8b68e8b8b4e738-023f72395912e208-00",
      "x-statsig-id": "rJjSb3x4vYeqAhsSFfBCJcF5bRyCdhlVuCcwCWcsID4QGSiCdVY0PRuaUNH5ePiRhtRFqKkAWwkjU2lUbxuTk7zlCFNsrw",
      "x-xai-request-id": "b82bb1df-cabe-4fcc-acc2-f124742aa40d",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/tasks/inactive", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-8cde7f0520ac11d3-0",
      "traceparent": "00-3297b5df0f4582c0ccd1dbb6d5036d77-74e040db3356a451-00",
      "x-statsig-id": "qJzWa3h8uYOuBh8WEfRGIcV9aRiGch1RvCM0DWMoJDoUHSyGcVIwOR+eVNX9fPyVgtBBrK2Rn3Eicty4ivkpXDp8uhoBqw",
      "x-xai-request-id": "37c2b193-35c4-4919-a1e5-4fe191edaf2a",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/notifications/list?pageSize=50", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-834f2dd409266b8d-0",
      "traceparent": "00-e5c8cfad3894baa0dd82d65e35a0982d-7df005ad2dc7b9b0-00",
      "x-statsig-id": "l6PpVEdDhryROSApLst5HvpCVie5TSJugxwLMlwXGwUrIhO5Tm0PBiCha+rCQ8Oqve9+k5JMuMXxSGpXMH6mZei0KA9WlA",
      "x-xai-request-id": "4639c591-54fb-4474-8e2a-9afcc124bac4",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/d49a75014d35cf4c.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/vs/editor/editor.main.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://apis.google.com/_/scs/abc-static/_/js/k=gapi.lb.ru.u6gjU0_gepE.O/m=picker/rt=j/sv=1/d=1/ed=1/rs=AHpOoo_4ykzqvXcihhPWRHS7NZHTJda0DA/cb=gapi.loaded_0?le=scs,fedcm_migration_mod", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/icon-192x192.png", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/45cf2b0e0ec36adc.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/vs/editor/editor.main.css", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/vs/editor/editor.main.nls.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/6d3bfe402235a292.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations_v2/db25589d-470e-4c8a-9327-d547f126d1f6?includeWorkspaces=true&includeTaskResult=true&rid=c50ca230-f229-476d-8990-bcb992893698", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-9f211ee0e569a2e8-0",
      "traceparent": "00-6584a7615e8fd74eab194b4e0e249fae-658abec30c0a416d-00",
      "x-statsig-id": "Ow9F+OvvKhA9lYyFgmfVslbu+osV4Y7CL7CnnvC7t6mHjr8V4sGjqowNx0Zu728GEUPSPz61hYE2w7hoeQgDRRe4EZB8OA",
      "x-xai-request-id": "5466791d-73c9-4947-b3b5-d3359d3409db",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/media/9c72aa0f40e4eef8.18a48cbc.woff2", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/_next/static/chunks/9e341644ff7c95b7.css"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations_v2/db25589d-470e-4c8a-9327-d547f126d1f6?includeWorkspaces=true&includeTaskResult=true", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b4c0762f9edfad17-0",
      "traceparent": "00-dc76697b4472beebc1f3f6958a818d8e-533bc22033fb53ec-00",
      "x-statsig-id": "JhJY5fbyNw0giJGYn3rIr0vz55YI/JPfMq26g+2mqrSak6II/9y+t5EQ2ltz8nIbDF/PIiNz5pHPZZXH/TEzqGVMx/jeJQ",
      "x-xai-request-id": "a28663fe-ca70-4573-a493-872aef7d12de",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations/db25589d-470e-4c8a-9327-d547f126d1f6/response-node?includeThreads=true", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-a2ccb28a4acacb9d-0",
      "traceparent": "00-96f3ebaac7fe6a97cb19768f729f24f4-507cada1421aa1d0-00",
      "x-statsig-id": "T3sxjJ+bXmRJ4fjx9hOhxiKajv9hlfq2W8TT6oTPw93z+sthlrXX3vh5szIamxtyZTamS0pdFQGwafWVAjqq1SEulsqcTA",
      "x-xai-request-id": "355ba1ce-c2a2-40f5-96d5-bf15d4fb512d",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations/db25589d-470e-4c8a-9327-d547f126d1f6/response-node?includeThreads=true", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-bc2a5d829fe9bdf7-0",
      "traceparent": "00-1fc7d9dfffdf4a7036db3a8089682f67-8bd3145d751f45d5-00",
      "x-statsig-id": "fEgCv6yobVd60svCxSCS9RGpvcxSpsmFaPfg2bf88O7AyfhSpYbk7ctKgAEpqChBVgWVeHluJjKDWsamMQmZ5hIdpfmvfw",
      "x-xai-request-id": "2a29b17f-79ca-4404-95f9-69612de3ce60",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations?pageSize=60", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b00069f90a99a40c-0",
      "traceparent": "00-a238f3fe02e36e94a39359901f1dd629-d9c491d56837faba-00",
      "x-statsig-id": "s4fNcGNnopi1HQQNCu9dOt5mcgOdaQZKpzgvFngzPyEPBjedakkrIgSFT87mZ+eOmcpat7ZZmWUuVPEdw47GTRkdnp2jsA",
      "x-xai-request-id": "23f55ff3-7256-4fc6-85ec-f395d019fbee",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/share_links?pageSize=100&conversationId=db25589d-470e-4c8a-9327-d547f126d1f6", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=5369b5704658896f32b5298b2b962a22b9812b00,sentry-public_key=b311e0f2690c81f25e2c4cf6d4f7ce1c,sentry-trace_id=87fa38cb8990c721f8468decc2250967,sentry-org_id=4508179396558848,sentry-sampled=false,sentry-sample_rand=0.004178313280689627,sentry-sample_rate=0",
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b8fed1fb62ea5e08-0",
      "traceparent": "00-bd5aba49f1bffe718151915e8c060f3d-f59ef0adce08d6db-00",
      "x-statsig-id": "y/+1CBsf2uDNZXx1cpclQqYeCnvlEX4y30BXbgBLR1l3fk/lEjFTWnz9N7aeH5/24bIiz84aSrc+DHRk8RJHADi6S/7pyA",
      "x-xai-request-id": "5e2e7363-086a-495b-9f5f-2f6cecba2305",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/rest/app-chat/conversations/db25589d-470e-4c8a-9327-d547f126d1f6/load-responses", {
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-ad4a245d75fbbb30-0",
      "traceparent": "00-0cd194f7935ca6663585aaca16036a92-34a59a9b16b8fb19-00",
      "x-statsig-id": "kqbsUUJGg7mUPCUsK858G/9HUyK8SCdrhhkON1kSHgAuJxa8S2gKAyWkbu/HRsavuOt7lpeUpPdVyaWGamvthIBihKFVkQ",
      "x-xai-request-id": "44599f1e-3a2d-466b-87f5-9cec50998f7f",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"responseIds\":[\"c50ca230-f229-476d-8990-bcb992893698\",\"e8f30247-4395-45ce-becd-db817e14bc87\",\"4c00e730-891e-47d5-8f11-fd8fd96fcb36\",\"1097ac6d-1ed6-4de1-bc1a-b9718dcf3215\",\"4d6ccefe-3531-4970-a590-6b482cf2fe69\",\"3c3e7804-fa0f-4af0-a1c3-b24526c510d5\"]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/_next/static/chunks/2b1b1093db16e23d.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_next/static/chunks/570149b7bc929189.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/_data/v1/events", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"api_key\":\"un1QuRAfyI8BJ69HyL3Eq8TyiIKHfHsheVxL65BTREI=\",\"viewer_context\":{\"request_id\":\"88cc74fd-5c2a-40e7-8c23-bc03a9842e23\",\"user_attributes\":{\"user_id\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"user_type\":\"LoggedIn\",\"subscription_level\":\"Free\",\"country\":\"LV\",\"email\":\"x@mrboomdev.ru\",\"locale\":\"en\",\"language\":\"en\"},\"device_attributes\":{\"app_name\":\"Grok Web\",\"app_version\":\"unset\",\"os_name\":\"Linux\",\"os_version\":\"Unknown\",\"device_vendor\":\"Unknown\",\"device_model\":\"Unknown\",\"device_version\":\"Unknown\"}},\"events\":[{\"event_name\":\"initialize_gdpr_user_settings\",\"event_value\":\"LV\",\"event_metadata\":{\"location\":\"loadout\",\"countryCode\":\"LV\",\"hasPreviouslyInitUserSettings\":\"true\"},\"timestamp\":\"2025-12-30T22:06:32.569Z\"},{\"event_name\":\"loadout_success\",\"event_value\":\"true\",\"event_metadata\":{\"location\":\"loadout\"},\"timestamp\":\"2025-12-30T22:06:32.575Z\"},{\"event_name\":\"tasks_side_panel_open\",\"event_metadata\":{\"location\":\"tasks-side-panel:useEffect\"},\"timestamp\":\"2025-12-30T22:06:33.137Z\"},{\"event_name\":\"session_active_time\",\"event_value\":\"428.79999999701977\",\"event_metadata\":{\"location\":\"session-tracker\",\"sessionActiveTimeMs\":\"428.79999999701977\",\"totalActiveTimeMs\":\"428.79999999701977\",\"page\":\"\"},\"timestamp\":\"2025-12-30T22:06:33.138Z\"},{\"event_name\":\"response_viewed\",\"event_value\":\"4d6ccefe-3531-4970-a590-6b482cf2fe69\",\"event_metadata\":{\"location\":\"use-log-response-viewed\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"4d6ccefe-3531-4970-a590-6b482cf2fe69\"},\"timestamp\":\"2025-12-30T22:06:33.529Z\"},{\"event_name\":\"response_viewed\",\"event_value\":\"c50ca230-f229-476d-8990-bcb992893698\",\"event_metadata\":{\"location\":\"use-log-response-viewed\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"c50ca230-f229-476d-8990-bcb992893698\"},\"timestamp\":\"2025-12-30T22:06:33.529Z\"},{\"event_name\":\"response_viewed\",\"event_value\":\"4c00e730-891e-47d5-8f11-fd8fd96fcb36\",\"event_metadata\":{\"location\":\"use-log-response-viewed\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"4c00e730-891e-47d5-8f11-fd8fd96fcb36\"},\"timestamp\":\"2025-12-30T22:06:33.530Z\"},{\"event_name\":\"response_viewed\",\"event_value\":\"4d6ccefe-3531-4970-a590-6b482cf2fe69\",\"event_metadata\":{\"location\":\"use-log-response-viewed\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"4d6ccefe-3531-4970-a590-6b482cf2fe69\"},\"timestamp\":\"2025-12-30T22:06:33.562Z\"},{\"event_name\":\"response_viewed\",\"event_value\":\"c50ca230-f229-476d-8990-bcb992893698\",\"event_metadata\":{\"location\":\"use-log-response-viewed\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"c50ca230-f229-476d-8990-bcb992893698\"},\"timestamp\":\"2025-12-30T22:06:33.562Z\"},{\"event_name\":\"response_viewed\",\"event_value\":\"4d6ccefe-3531-4970-a590-6b482cf2fe69\",\"event_metadata\":{\"location\":\"use-log-response-viewed\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"4d6ccefe-3531-4970-a590-6b482cf2fe69\"},\"timestamp\":\"2025-12-30T22:06:33.583Z\"}]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/api/log_metric", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "[{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"GET conversations\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"GET conversations\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"GET \"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"GET \"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":202},{\"type\":\"client_fetch_success\",\"endpoint\":\"GET conversations\",\"latencyMs\":202},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":250},{\"type\":\"client_fetch_success\",\"endpoint\":\"GET conversations\",\"latencyMs\":304},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":370},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":384},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":386},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":383},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":388},{\"type\":\"client_fetch_success\",\"endpoint\":\"GET \",\"latencyMs\":387},{\"type\":\"client_fetch_success\",\"endpoint\":\"GET \",\"latencyMs\":386},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"GET conversations\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":214},{\"type\":\"wv_ttfb\",\"valueMs\":405.79999999701977,\"dnsLookup\":13.5,\"tcpHandshake\":97.79999999701977,\"tlsHandshake\":97.60000000149012,\"domParsing\":278.3999999985099,\"decodedBodySize\":235862,\"encodedBodySize\":61478},{\"type\":\"wv_fcp\",\"valueMs\":2192},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":181},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":190},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":169},{\"type\":\"client_fetch_success\",\"endpoint\":\"GET conversations\",\"latencyMs\":235},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":356},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":190}]",
    "method": "POST"
  }); ;
  fetch("https://www.google-analytics.com/g/collect?v=2&tid=G-8FEWB057YH&gtm=45je5ca1v9206809855za200zd9206809855&_p=1767132392111&gcd=13l3l3l3l1l1&npa=0&dma=0&cid=83069579.1765227275&ul=ru&sr=1920x1080&uaa=x86&uab=64&uafvl=Chromium%3B142.0.7444.245%7CGoogle%2520Chrome%3B142.0.7444.245%7CNot_A%2520Brand%3B99.0.0.0&uamb=0&uam=&uap=Linux&uapv=6.18.2&uaw=0&are=1&frm=0&pscdl=noapi&_eu=AEAAAAQ&_s=2&tag_exp=103116026~103200004~104527906~104528501~104684208~104684211~105391253~115583767~115616986~115938465~115938469~116184927~116184929~116251938~116251940~116682876~116744867&sid=1767129805&sct=22&seg=1&dl=https%3A%2F%2Fgrok.com%2Fc%2Fdb25589d-470e-4c8a-9327-d547f126d1f6%3Frid%3Dc50ca230-f229-476d-8990-bcb992893698&dt=Grok&en=scroll&epn.percent_scrolled=90&tfd=6577", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "cross-site",
      "sec-fetch-storage-access": "active",
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "POST"
  }); ;
  fetch("https://grok.com/_data/v1/events", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"api_key\":\"un1QuRAfyI8BJ69HyL3Eq8TyiIKHfHsheVxL65BTREI=\",\"viewer_context\":{\"request_id\":\"d6bee848-f613-4fc5-ba9d-4c03497ca347\",\"user_attributes\":{\"user_id\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"user_type\":\"LoggedIn\",\"subscription_level\":\"Free\",\"country\":\"LV\",\"email\":\"x@mrboomdev.ru\",\"locale\":\"en\",\"language\":\"en\"},\"device_attributes\":{\"app_name\":\"Grok Web\",\"app_version\":\"unset\",\"os_name\":\"Linux\",\"os_version\":\"Unknown\",\"device_vendor\":\"Unknown\",\"device_model\":\"Unknown\",\"device_version\":\"Unknown\"}},\"events\":[{\"event_name\":\"session_active_time\",\"event_value\":\"12942.60000000149\",\"event_metadata\":{\"location\":\"session-tracker\",\"sessionActiveTimeMs\":\"12942.60000000149\",\"totalActiveTimeMs\":\"13371.39999999851\",\"page\":\"chat\"},\"timestamp\":\"2025-12-30T22:06:46.080Z\"}]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/_data/v1/events", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"api_key\":\"un1QuRAfyI8BJ69HyL3Eq8TyiIKHfHsheVxL65BTREI=\",\"viewer_context\":{\"request_id\":\"4bf81785-fa72-434d-99b2-05a70c9744e2\",\"user_attributes\":{\"user_id\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"user_type\":\"LoggedIn\",\"subscription_level\":\"Free\",\"country\":\"LV\",\"email\":\"x@mrboomdev.ru\",\"locale\":\"en\",\"language\":\"en\"},\"device_attributes\":{\"app_name\":\"Grok Web\",\"app_version\":\"unset\",\"os_name\":\"Linux\",\"os_version\":\"Unknown\",\"device_vendor\":\"Unknown\",\"device_model\":\"Unknown\",\"device_version\":\"Unknown\"}},\"events\":[{\"event_name\":\"session_active_time\",\"event_value\":\"13918.30000000447\",\"event_metadata\":{\"location\":\"session-tracker\",\"sessionActiveTimeMs\":\"13918.30000000447\",\"totalActiveTimeMs\":\"27289.70000000298\",\"page\":\"chat\"},\"timestamp\":\"2025-12-30T22:07:00.111Z\"}]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/monitoring?o=4508179396558848&p=4508493378158592&r=us", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "content-type": "text/plain;charset=UTF-8",
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
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/"
    },
    "body": "{\"dsn\":\"https://b311e0f2690c81f25e2c4cf6d4f7ce1c@o4508179396558848.ingest.us.sentry.io/4508493378158592\"}\n{\"type\":\"client_report\"}\n{\"timestamp\":1767132477.579,\"discarded_events\":[{\"reason\":\"sample_rate\",\"category\":\"transaction\",\"quantity\":1}]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/cdn-cgi/rum?", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"referrer\":\"\",\"eventType\":3,\"versions\":{\"js\":\"2024.6.1\",\"fl\":\"2025.9.1\"},\"pageloadId\":\"a2884c21-95ad-4e27-9bbb-58a30cf15f06\",\"location\":\"https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6\",\"landingPath\":\"/c/db25589d-470e-4c8a-9327-d547f126d1f6\",\"startTime\":1767132390876.8,\"nt\":\"reload\",\"serverTimings\":[{\"name\":\"cfCacheStatus\",\"dur\":0,\"desc\":\"DYNAMIC\"},{\"name\":\"cfOrigin\",\"dur\":0,\"desc\":\"\"},{\"name\":\"cfEdge\",\"dur\":219,\"desc\":\"\"}],\"siteToken\":\"115d22700e41497cb28a5ee6c20b51d7\",\"lcp\":{\"value\":2676,\"path\":\"/c/db25589d-470e-4c8a-9327-d547f126d1f6\",\"element\":\"p.break-words.last:mb-0\",\"size\":36150,\"rld\":0,\"rlt\":0,\"erd\":2270.2000000029802,\"fp\":null},\"fid\":{\"value\":-1},\"cls\":{\"value\":0.09840056148723507,\"path\":\"/c/db25589d-470e-4c8a-9327-d547f126d1f6\",\"element\":\"div.absolute.flex.flex-row.items-center.gap-0.5.ms-auto.end-3\",\"currentRect\":{\"x\":610,\"y\":12,\"width\":188,\"height\":40,\"top\":12,\"right\":798,\"bottom\":52,\"left\":610},\"previousRect\":{\"x\":710,\"y\":12,\"width\":88,\"height\":40,\"top\":12,\"right\":798,\"bottom\":52,\"left\":710}},\"fcp\":{\"value\":2192,\"path\":\"/c/db25589d-470e-4c8a-9327-d547f126d1f6\"},\"ttfb\":{\"value\":405.79999999701977,\"path\":\"/c/db25589d-470e-4c8a-9327-d547f126d1f6\"},\"inp\":{\"value\":-1},\"timingsV2\":{\"nextHopProtocol\":\"h2\",\"transferSize\":61778,\"decodedBodySize\":235862},\"dt\":\"\",\"st\":1}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/api/log_metric", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "[{\"type\":\"wv_lcp\",\"valueMs\":2676}]",
    "method": "POST"
  }); ;
  fetch("https://grok.com/_data/v1/events", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"api_key\":\"un1QuRAfyI8BJ69HyL3Eq8TyiIKHfHsheVxL65BTREI=\",\"viewer_context\":{\"request_id\":\"3f168dc9-c56a-4152-9ad4-ba3257bbc644\",\"user_attributes\":{\"user_id\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"user_type\":\"LoggedIn\",\"subscription_level\":\"Free\",\"country\":\"LV\",\"email\":\"x@mrboomdev.ru\",\"locale\":\"en\",\"language\":\"en\"},\"device_attributes\":{\"app_name\":\"Grok Web\",\"app_version\":\"unset\",\"os_name\":\"Linux\",\"os_version\":\"Unknown\",\"device_vendor\":\"Unknown\",\"device_model\":\"Unknown\",\"device_version\":\"Unknown\"}},\"events\":[{\"event_name\":\"session_active_time\",\"event_value\":\"973.5\",\"event_metadata\":{\"location\":\"session-tracker\",\"sessionActiveTimeMs\":\"973.5\",\"totalActiveTimeMs\":\"28263.20000000298\",\"page\":\"chat\"},\"timestamp\":\"2025-12-30T22:07:57.580Z\"}]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/api/oauth-connectors", {
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b36664f6c9fdd4d8-0",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
  fetch("https://grok.com/api/log_metric", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "[{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":192}]",
    "method": "POST"
  }); ;
  fetch("https://grok.com/_data/v1/events", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "{\"api_key\":\"un1QuRAfyI8BJ69HyL3Eq8TyiIKHfHsheVxL65BTREI=\",\"viewer_context\":{\"request_id\":\"29b5625f-cbeb-47b2-8d7f-ae8273a0492e\",\"user_attributes\":{\"user_id\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"user_type\":\"LoggedIn\",\"subscription_level\":\"Free\",\"country\":\"LV\",\"email\":\"x@mrboomdev.ru\",\"locale\":\"en\",\"language\":\"en\"},\"device_attributes\":{\"app_name\":\"Grok Web\",\"app_version\":\"unset\",\"os_name\":\"Linux\",\"os_version\":\"Unknown\",\"device_vendor\":\"Unknown\",\"device_model\":\"Unknown\",\"device_version\":\"Unknown\"}},\"events\":[{\"event_name\":\"session_active_time\",\"event_value\":\"10888.40000000596\",\"event_metadata\":{\"location\":\"session-tracker\",\"sessionActiveTimeMs\":\"10888.40000000596\",\"totalActiveTimeMs\":\"39151.60000000894\",\"page\":\"chat\"},\"timestamp\":\"2025-12-30T22:08:21.581Z\"}]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/api/log_metric", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": "[{\"type\":\"pressure_observer\",\"source\":\"cpu\",\"state\":\"nominal\"}]",
    "method": "POST"
  }); ;
  fetch("https://grok.com/_next/static/chunks/c6938dcb88bf42c4.js", {
    "headers": {
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=c50ca230-f229-476d-8990-bcb992893698"
    },
    "body": null,
    "method": "GET"
  }); ;
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
  }); ;
  fetch("https://grok.com/monitoring?o=4508179396558848&p=4508493378158592&r=us", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "content-type": "text/plain;charset=UTF-8",
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
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/"
    },
    "body": "{\"sent_at\":\"2025-12-30T22:08:58.135Z\",\"sdk\":{\"name\":\"sentry.javascript.nextjs\",\"version\":\"10.29.0\"},\"dsn\":\"https://b311e0f2690c81f25e2c4cf6d4f7ce1c@o4508179396558848.ingest.us.sentry.io/4508493378158592\"}\n{\"type\":\"session\"}\n{\"sid\":\"0d99af7fe2c347ffa089b4975fce02f9\",\"init\":false,\"started\":\"2025-12-30T22:06:31.589Z\",\"timestamp\":\"2025-12-30T22:08:58.136Z\",\"status\":\"exited\",\"errors\":0,\"did\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"attrs\":{\"release\":\"5369b5704658896f32b5298b2b962a22b9812b00\",\"environment\":\"production\",\"user_agent\":\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\"}}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/monitoring?o=4508179396558848&p=4508493378158592&r=us", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "content-type": "text/plain;charset=UTF-8",
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
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/"
    },
    "body": "{\"sent_at\":\"2025-12-30T22:08:58.136Z\",\"sdk\":{\"name\":\"sentry.javascript.nextjs\",\"version\":\"10.29.0\"},\"dsn\":\"https://b311e0f2690c81f25e2c4cf6d4f7ce1c@o4508179396558848.ingest.us.sentry.io/4508493378158592\"}\n{\"type\":\"session\"}\n{\"sid\":\"8fc1102eb4d5493a954c430a9d705298\",\"init\":true,\"started\":\"2025-12-30T22:08:58.135Z\",\"timestamp\":\"2025-12-30T22:08:58.136Z\",\"status\":\"ok\",\"errors\":0,\"attrs\":{\"release\":\"5369b5704658896f32b5298b2b962a22b9812b00\",\"environment\":\"production\",\"user_agent\":\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\"}}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/monitoring?o=4508179396558848&p=4508493378158592&r=us", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "content-type": "text/plain;charset=UTF-8",
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
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/"
    },
    "body": "{\"sent_at\":\"2025-12-30T22:08:58.264Z\",\"sdk\":{\"name\":\"sentry.javascript.nextjs\",\"version\":\"10.29.0\"},\"dsn\":\"https://b311e0f2690c81f25e2c4cf6d4f7ce1c@o4508179396558848.ingest.us.sentry.io/4508493378158592\"}\n{\"type\":\"session\"}\n{\"sid\":\"8fc1102eb4d5493a954c430a9d705298\",\"init\":false,\"started\":\"2025-12-30T22:08:58.135Z\",\"timestamp\":\"2025-12-30T22:08:58.264Z\",\"status\":\"exited\",\"errors\":0,\"attrs\":{\"release\":\"5369b5704658896f32b5298b2b962a22b9812b00\",\"environment\":\"production\",\"user_agent\":\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\"}}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/monitoring?o=4508179396558848&p=4508493378158592&r=us", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "content-type": "text/plain;charset=UTF-8",
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
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/"
    },
    "body": "{\"sent_at\":\"2025-12-30T22:08:58.265Z\",\"sdk\":{\"name\":\"sentry.javascript.nextjs\",\"version\":\"10.29.0\"},\"dsn\":\"https://b311e0f2690c81f25e2c4cf6d4f7ce1c@o4508179396558848.ingest.us.sentry.io/4508493378158592\"}\n{\"type\":\"session\"}\n{\"sid\":\"cc5e5c542e5f4a848c27fc8bf83d9d93\",\"init\":true,\"started\":\"2025-12-30T22:08:58.264Z\",\"timestamp\":\"2025-12-30T22:08:58.264Z\",\"status\":\"ok\",\"errors\":0,\"attrs\":{\"release\":\"5369b5704658896f32b5298b2b962a22b9812b00\",\"environment\":\"production\",\"user_agent\":\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36\"}}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/rest/rate-limits", {
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
      "sentry-trace": "87fa38cb8990c721f8468decc2250967-b3a570210b3ef8a0-0",
      "traceparent": "00-f2aff2b0aa70e0144fdbd13c1be0acad-e882ab41e0f4c579-00",
      "x-statsig-id": "oJTeY3B0sYumDhceGfxOKc11YRCOehVZtCs8BWsgLDIcFSSOeVo4MReWXN31dPSdiqtKpKVmtqgytLIymL7irii/DFLlow",
      "x-xai-request-id": "b26ff105-5105-410c-b60f-81236b59d84b",
      "cookie": "i18nextLng=en; stblid=7662c815-4baf-4cb9-86f3-1380997f71bd; sso=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; sso-rw=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX2lkIjoiYTA1Njg3ODAtZmViNi00YzY4LWI4ODgtNTNiYWNmYTRhODVlIn0.HvqkHbkbDCGNOmvlog0MXwtGYwSFUCCBlAKd44XsSkc; _ga=GA1.1.83069579.1765227275; x-userid=02ae5531-ca97-4722-bee2-c289c7dea8bc; cf_clearance=31jT4J9EO8LnIzih10iz_3ROyKTo_cIkK0hEYRF657E-1767132392-1.2.1.1-Nc8VQowgjDpsU.DpftF5S0sBJ_.t4PwVzp88FSeskkl6NsuFWKHnSWosFVyHaLJmHo0LbuOX1KoDZvisIn0DWKzPJyNSy2jHovBknM7FL.27TApQlPYANT45Ha2ULMoe9G3SFvM3zKgrQipbF9sK2GWxKi5qoVijqGeDNFM9uoGUzxrP.EQ70LbmFI2c0buX6PWL1xr3LZv2bLbYqlQmh9YjUXf7nR3goT4cFmnt_TU; _ga_8FEWB057YH=GS2.1.s1767129805$o22$g1$t1767132392$j59$l0$h0",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=eb2205dd-1339-4d82-bc1c-c0501897a717"
    },
    "body": "{\"requestKind\":\"DEFAULT\",\"modelName\":\"grok-4-1-thinking-1129\"}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/_data/v1/events", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=eb2205dd-1339-4d82-bc1c-c0501897a717"
    },
    "body": "{\"api_key\":\"un1QuRAfyI8BJ69HyL3Eq8TyiIKHfHsheVxL65BTREI=\",\"viewer_context\":{\"request_id\":\"286f6368-c412-4c10-a877-7fced7622b61\",\"user_attributes\":{\"user_id\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"user_type\":\"LoggedIn\",\"subscription_level\":\"Free\",\"country\":\"LV\",\"email\":\"x@mrboomdev.ru\",\"locale\":\"en\",\"language\":\"en\"},\"device_attributes\":{\"app_name\":\"Grok Web\",\"app_version\":\"unset\",\"os_name\":\"Linux\",\"os_version\":\"Unknown\",\"device_vendor\":\"Unknown\",\"device_model\":\"Unknown\",\"device_version\":\"Unknown\"}},\"events\":[{\"event_name\":\"send_query\",\"event_value\":\"\",\"event_metadata\":{\"selectedModel\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"reasoningMode\":\"none\",\"bestSubscription\":\"\",\"deviceType\":\"desktop\",\"messageLength\":\"4\",\"fileAttachments\":\"0\",\"queryTimestamp\":\"1767132537698\",\"sessionStartTimestamp\":\"1767132392483\",\"compositionTime\":\"2766\",\"backspaceCount\":\"2\",\"avgKeystrokeLatency\":\"275.6\",\"fileIds\":\"undefined\",\"suggestionsShownCount\":\"undefined\",\"suggestionUsed\":\"excluded\",\"location\":\"chat-input\",\"personalityId\":\"\",\"personaId\":\"\",\"conversationDepth\":\"6\",\"user\":\"true\",\"isThreadMessage\":\"false\",\"hadQuotedText\":\"false\",\"projectId\":\"undefined\",\"exampleId\":\"no-example-id\",\"parentResponseId\":\"c50ca230-f229-476d-8990-bcb992893698\"},\"timestamp\":\"2025-12-30T22:08:57.699Z\"},{\"event_name\":\"response_confirmed\",\"event_value\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"event_metadata\":{\"originalSendTimeMs\":\"1767132537700\",\"parentResponseId\":\"33f95998-b4ef-4684-873d-7c008d12005d\",\"responseId\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"location\":\"response-store:maybeProcessResponseChunk\"},\"timestamp\":\"2025-12-30T22:08:58.263Z\"},{\"event_name\":\"response_start_streaming\",\"event_value\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"event_metadata\":{\"location\":\"response-store:streamResponse\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"subscriptionTier\":\"unknown\",\"modelId\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\"},\"timestamp\":\"2025-12-30T22:08:58.927Z\"},{\"event_name\":\"response_start_streaming_summary\",\"event_value\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"event_metadata\":{\"location\":\"response-store:streamResponse\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"subscriptionTier\":\"unknown\",\"modelId\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\",\"deltaMs\":\"1\"},\"timestamp\":\"2025-12-30T22:08:58.928Z\"},{\"event_name\":\"summary_first_token_rendered\",\"event_value\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"event_metadata\":{\"location\":\"response-content:ObservedMarkdownContainer\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\"},\"timestamp\":\"2025-12-30T22:08:58.993Z\"},{\"event_name\":\"generation_time_ms\",\"event_value\":\"1552\",\"event_metadata\":{\"location\":\"response-store\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\"},\"timestamp\":\"2025-12-30T22:08:59.252Z\"},{\"event_name\":\"finished_query\",\"event_value\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"event_metadata\":{\"location\":\"response-store\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\"},\"timestamp\":\"2025-12-30T22:08:59.252Z\"},{\"event_name\":\"summary_last_token_rendered\",\"event_value\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"event_metadata\":{\"location\":\"response-content:ObservedMarkdownContainer\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\"},\"timestamp\":\"2025-12-30T22:08:59.275Z\"},{\"event_name\":\"response_viewed\",\"event_value\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\",\"event_metadata\":{\"location\":\"use-log-response-viewed\",\"conversationId\":\"db25589d-470e-4c8a-9327-d547f126d1f6\",\"responseId\":\"eb2205dd-1339-4d82-bc1c-c0501897a717\"},\"timestamp\":\"2025-12-30T22:08:59.327Z\"}]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/api/log_metric", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=eb2205dd-1339-4d82-bc1c-c0501897a717"
    },
    "body": "[{\"type\":\"pressure_observer\",\"source\":\"cpu\",\"state\":\"nominal\"},{\"type\":\"client_fetch_start\",\"endpoint\":\"POST conversations/{conversationid}/responses\"},{\"type\":\"client_fetch_success\",\"endpoint\":\"POST conversations/{conversationid}/responses\",\"latencyMs\":370},{\"type\":\"send_query_stream_start\",\"subscriptionTier\":\"unknown\",\"modelId\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\"},{\"type\":\"time_to_first_chunk\",\"subscriptionTier\":\"unknown\",\"modelId\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\",\"timeToFirstChunkMs\":433},{\"type\":\"time_to_first_token\",\"subscriptionTier\":\"unknown\",\"modelId\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\",\"timeToFirstTokenMs\":1226},{\"type\":\"time_to_first_summary_token\",\"subscriptionTier\":\"unknown\",\"modelId\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\",\"timeToFirstSummaryTokenMs\":1227},{\"type\":\"client_fetch_start\",\"endpoint\":\"unknown\"},{\"type\":\"client_fetch_success\",\"endpoint\":\"unknown\",\"latencyMs\":222},{\"type\":\"send_query_stream_success\",\"subscriptionTier\":\"unknown\",\"modelId\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\"},{\"type\":\"milliseconds_per_token\",\"subscriptionTier\":\"unknown\",\"modelId\":\"grok-4-1-thinking-1129\",\"modelMode\":\"grok-4-1\",\"millisecondsPerTokenList\":[27,128,80,584,67,0,2,0,0,0,35,26,0,33,27,0,4,0,35,27,0,0,38,30,0,0,0,2,593],\"modelHash\":\"yDfU6BCPuvZeRINNa3/crzL27tDf/vXgugt9r586yL0=\"},{\"type\":\"pressure_observer\",\"source\":\"cpu\",\"state\":\"nominal\"}]",
    "method": "POST"
  }); ;
  fetch("https://www.google-analytics.com/g/collect?v=2&tid=G-8FEWB057YH&gtm=45je5ca1v9206809855za200zd9206809855&_p=1767132392111&gcd=13l3l3l3l1l1&npa=0&dma=0&cid=83069579.1765227275&ul=ru&sr=1920x1080&uaa=x86&uab=64&uafvl=Chromium%3B142.0.7444.245%7CGoogle%2520Chrome%3B142.0.7444.245%7CNot_A%2520Brand%3B99.0.0.0&uamb=0&uam=&uap=Linux&uapv=6.18.2&uaw=0&are=1&frm=0&pscdl=noapi&_eu=AEAAAAQ&_s=3&tag_exp=103116026~103200004~104527906~104528501~104684208~104684211~105391253~115583767~115616986~115938465~115938469~116184927~116184929~116251938~116251940~116682876~116744867&dl=https%3A%2F%2Fgrok.com%2Fc%2Fdb25589d-470e-4c8a-9327-d547f126d1f6%3Frid%3Deb2205dd-1339-4d82-bc1c-c0501897a717&dr=https%3A%2F%2Fgrok.com%2Fc%2Fdb25589d-470e-4c8a-9327-d547f126d1f6%3Frid%3Dc50ca230-f229-476d-8990-bcb992893698&sid=1767129805&sct=22&seg=1&dt=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82%D1%81%D1%82%D0%B2%D0%B8%D0%B5%20%D0%B8%20%D0%BF%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BF%D0%BE%D0%BC%D0%BE%D1%89%D0%B8%20-%20Grok&en=page_view&_et=10378&tfd=154474", {
    "headers": {
      "accept": "*/*",
      "accept-language": "ru,en-US;q=0.9,en;q=0.8",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-site": "cross-site",
      "sec-fetch-storage-access": "active",
      "Referer": "https://grok.com/"
    },
    "body": null,
    "method": "POST"
  }); ;
  fetch("https://grok.com/_data/v1/events", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=eb2205dd-1339-4d82-bc1c-c0501897a717"
    },
    "body": "{\"api_key\":\"un1QuRAfyI8BJ69HyL3Eq8TyiIKHfHsheVxL65BTREI=\",\"viewer_context\":{\"request_id\":\"2dd2c9b4-3abb-45fc-b835-11cde2183215\",\"user_attributes\":{\"user_id\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"user_type\":\"LoggedIn\",\"subscription_level\":\"Free\",\"country\":\"LV\",\"email\":\"x@mrboomdev.ru\",\"locale\":\"en\",\"language\":\"en\"},\"device_attributes\":{\"app_name\":\"Grok Web\",\"app_version\":\"unset\",\"os_name\":\"Linux\",\"os_version\":\"Unknown\",\"device_vendor\":\"Unknown\",\"device_model\":\"Unknown\",\"device_version\":\"Unknown\"}},\"events\":[{\"event_name\":\"session_active_time\",\"event_value\":\"22895.39999999851\",\"event_metadata\":{\"location\":\"session-tracker\",\"sessionActiveTimeMs\":\"22895.39999999851\",\"totalActiveTimeMs\":\"62047.00000000745\",\"page\":\"chat\"},\"timestamp\":\"2025-12-30T22:09:13.780Z\"}]}",
    "method": "POST"
  }); ;
  fetch("https://grok.com/_data/v1/events", {
    "headers": {
      "content-type": "application/json",
      "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
      "sec-ch-ua-arch": "\"x86\"",
      "sec-ch-ua-bitness": "\"64\"",
      "sec-ch-ua-full-version": "\"142.0.7444.245\"",
      "sec-ch-ua-full-version-list": "\"Chromium\";v=\"142.0.7444.245\", \"Google Chrome\";v=\"142.0.7444.245\", \"Not_A Brand\";v=\"99.0.0.0\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": "\"\"",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-ch-ua-platform-version": "\"6.18.2\"",
      "Referer": "https://grok.com/c/db25589d-470e-4c8a-9327-d547f126d1f6?rid=eb2205dd-1339-4d82-bc1c-c0501897a717"
    },
    "body": "{\"api_key\":\"un1QuRAfyI8BJ69HyL3Eq8TyiIKHfHsheVxL65BTREI=\",\"viewer_context\":{\"request_id\":\"11460354-7103-4122-882e-bf4411bd80a3\",\"user_attributes\":{\"user_id\":\"02ae5531-ca97-4722-bee2-c289c7dea8bc\",\"user_type\":\"LoggedIn\",\"subscription_level\":\"Free\",\"country\":\"LV\",\"email\":\"x@mrboomdev.ru\",\"locale\":\"en\",\"language\":\"en\"},\"device_attributes\":{\"app_name\":\"Grok Web\",\"app_version\":\"unset\",\"os_name\":\"Linux\",\"os_version\":\"Unknown\",\"device_vendor\":\"Unknown\",\"device_model\":\"Unknown\",\"device_version\":\"Unknown\"}},\"events\":[{\"event_name\":\"session_active_time\",\"event_value\":\"13010\",\"event_metadata\":{\"location\":\"session-tracker\",\"sessionActiveTimeMs\":\"13010\",\"totalActiveTimeMs\":\"75057.00000000745\",\"page\":\"chat\"},\"timestamp\":\"2025-12-30T22:09:28.075Z\"}]}",
    "method": "POST"
  });