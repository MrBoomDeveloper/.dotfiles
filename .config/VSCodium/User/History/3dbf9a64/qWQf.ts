import type { SQL } from "bun";
import type { StorageAdapter } from "grammy";

export function databseSessionStorage<S>(database: SQL): StorageAdapter<S> {
    return {
        async readAllKeys(): Promise<AsyncIterable<string>> {
            throw "";
        },

        async has(key: string): Promise<boolean> {
            return await database`SELECT EXISTS(SELECT 1 FROM data WHERE key = ${key});`;
        },

        async read(key: string): Promise<S | undefined> {
            const value = await database`SELECT value FROM data WHERE key = ${key}`;
            if(value.length == 0) return undefined;
            return JSON.parse(value[0].value);
        },

        async write(key: string, value: S): Promise<void> {
            if(await this.has?.(key)) {
                await database`UPDATE data SET value = ${JSON.stringify(value)} WHERE key = ${key}`;
                return;
            }

            await database`INSERT INTO data (key, value) VALUES (${key}, ${JSON.stringify(value)})`;
        },

        async delete(key: string): Promise<void> {
            await database`DELETE * FROM data WHERE key = '${key}'`;
        }
    }
}