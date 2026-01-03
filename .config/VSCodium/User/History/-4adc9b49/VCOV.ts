import type { Bot } from "grammy";
import { isBotKilled } from "./init";
import type { MyContext } from "../..";
import { sleep } from "bun";

export async function startup(bot: Bot<MyContext>) {
    while(true) {
        if(isBotKilled) break;
    
        if(!bot.isInited()) {
            await sleep(100);
            continue;
        }

        console.info(`Bot logged in as "${bot.botInfo.first_name}" @${bot.botInfo.username}`)
        break;
    }
}