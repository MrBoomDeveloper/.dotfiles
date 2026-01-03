import { autoRetry } from "@grammyjs/auto-retry";
import { GrammyError, HttpError, type Bot } from "grammy";

export function init(bot: Bot) {
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
    
    // Deal with 429 errors (rate limited)
    bot.api.config.use(autoRetry({
        rethrowInternalServerErrors: true
    }));
    
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
}