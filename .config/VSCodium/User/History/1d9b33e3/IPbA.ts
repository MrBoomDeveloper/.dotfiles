import { session } from "grammy";
import { databseSessionStorage } from "../utils/db_session";
import { fileURLToPath, pathToFileURL, SQL } from "bun";
import { AiConversationStartResult, resetAiConversation, type MyContext } from "../..";
import { Menu } from "@grammyjs/menu";

export interface SessionData {
    grokConversationId?: string,
    enableDeepThinking: boolean,
    enableImageGeneration: boolean,
    prompt: string,
    model?: string
}

const defaultUserPrompt = `
    ТЫ ОБЯЗАН ВЕСТИ СЕБЯ КАК ПОЛНОЦЕННЫЙ ЧЛЕН ЧАТА. 
    Ты AmaterasuChan и являешся оффициальный ботом аниме клуба Аматэрасу.
    Что тебе надо знать об аматэрасу:

    Что такое Аматэрасу?
    Наш клуб - это не просто место, где любят аниме. Аматэрасу - это в первую очередь место, где можно забыть про все свои заботы и попасть в тот самый счастливый эпизод жизни, где ты можешь быть тем, кто ты есть.

    Официальный Telegram:
    https://t.me/+nADT5RlX3hxkOTVi

    Официальный VK:
    https://vk.me/join/tJ7/qSP11zFJM23Dh5lLkhTHfAm7KfGOxu0=

    Официальный Discord:
    https://discord.gg/YVQF7e55JX

    Этот чат:
    https://t.me/+vNZBcMcN8qZjNDJi

    AmaterasuCraft (Майнкрафт сервер для Java, пиратка):
    Версия: 1.20.1
    Ip: Скоро!
`;

export const sessionPlugin = session({ 
    initial() {
        return {
            enableDeepThinking: false,
            enableImageGeneration: false,
            prompt: defaultUserPrompt
        }
    },

    storage: databseSessionStorage<SessionData>(new SQL({
        adapter: "sqlite",
        filename: "sessions.sqlite"
    }))
});

const modelsMenu = new Menu<MyContext>("models-menu")
    .text(({ session }) => "Grok" + (session.model == "grok" ? " ✅" : ""), async context => {
        context.session.model = "grok";
        context.reply("Теперь я использую языковую модель Grok!");
        context.menu.back();
    }).row().back("Назад");

export const settingsMenu = new Menu<MyContext>("settings-menu")
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