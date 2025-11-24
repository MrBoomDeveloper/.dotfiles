export function trimIndent(string: string): string {
    return string.replaceAll(/  +/g, '')
}