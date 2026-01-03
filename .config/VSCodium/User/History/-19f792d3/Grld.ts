export function parseJson(json: string): any {
    try {
        return JSON.parse(json);
    } catch(e) {
        throw Error(`Failed to parse json: "${json}"!`, { cause: e });
    }
}

export function requireEnvironmentVariable(name: string): any {
    return requireNotNull(process.env[name], `Environment variable "${name} is not specified!"`);
}

export function requireNotNull<T>(param: T | undefined, message: string): T {
    if(param == null || param == undefined) {
        throw new Error(message);
    }

    return param!!;
}