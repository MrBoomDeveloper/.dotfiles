export function trimIndent(string: string): string {
    return string.replace(/^ +/gm, '')
}