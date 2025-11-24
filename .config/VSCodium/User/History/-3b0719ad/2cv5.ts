export class YouTubeApi {
    cookies: string;
    locale: YouTubeLocale;
    visitorData: string | null;
    dataSyncId: string | null;

    constructor(
        cookies: string
    ) {
        this.cookies = cookies
    }
}