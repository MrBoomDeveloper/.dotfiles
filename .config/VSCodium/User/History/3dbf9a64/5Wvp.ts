import type { SQL } from "bun";
import type { StorageAdapter } from "grammy";

export function databseSessionStorage<S>(database: SQL): StorageAdapter<S> {
    return {
        async has(key): Promise<boolean> {
            const r = await database`SELECT EXISTS(SELECT 1 FROM data WHERE key = ${key});`;
            console.error(r);
            return r;
        },

        async read(key: string): Promise<S | undefined> {
            const value = await database`SELECT value FROM data WHERE key = ${key}`;
            if(Array.isArray(value) && value.length == 0) return undefined;
            return JSON.parse(value);
        },

        async write(key: string, value: S): Promise<void> {
            console.error(2);

            if(await has(key)) {
                await database`UPDATE INTO data (key, value) VALUES (${key}, ${JSON.stringify(value)})`;
                return;
            }

            await database`INSERT INTO data (key, value) VALUES (${key}, ${JSON.stringify(value)})`;
        },

        async delete(key: string): Promise<void> {
            console.error(3);
            await database`DELETE * FROM data WHERE key = '${key}'`;
        }
    }
}