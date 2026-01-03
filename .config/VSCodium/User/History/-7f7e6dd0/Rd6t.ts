export function parseJson(json: string): any {
    try {
        return JSON.parse(json);
    } catch(e) {
        throw Error(`Failed to parse json: "${json}"!`, { cause: e });
    }
}

export function require<T>(any: T | undefined, message: string): T {
    if(any == null || any == undefined) {
        
    }
}