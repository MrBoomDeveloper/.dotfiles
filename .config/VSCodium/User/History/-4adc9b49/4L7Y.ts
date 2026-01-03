import { isBotKilled } from "./init";

async function startup() {
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