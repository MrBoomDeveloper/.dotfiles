export interface SessionData {
    grokConversationId?: string,
    enableDeepThinking: boolean,
    enableImageGeneration: boolean,
    prompt: string,
    model?: string
}

const defaultUserPrompt = `
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

bot.use(session({ 
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
}));

const modelsMenu = new Menu<MyContext>("models-menu")
    .text(({ session }) => "Grok" + (session.model == "grok" ? " ✅" : ""), async context => {
        context.session.model = "grok";
        context.reply("Теперь я использую языковую модель Grok!");
        context.menu.back();
    }).row().back("Назад");