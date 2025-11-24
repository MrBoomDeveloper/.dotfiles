export class YouTubeApi {
    cookies: string;
    locale: YouTubeLocale;
    visitorData: string | null;
    dataSyncId: string | null;

    constructor(
        cookies: string,
        locale: YouTubeLocale,
        visitorData: string | null = null,
        dataSyncId: string | null = null
    ) {
        this.cookies = cookies
    }
}