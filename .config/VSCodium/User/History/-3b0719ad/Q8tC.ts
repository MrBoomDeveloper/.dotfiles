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
        this.locale = locale
        this.visitorData = visitorData
        this.dataSyncId = dataSyncId
    }
}

export class YouTubeLocale {
    gl: string; // geolocation
    hl: string; // host language

    constructor(
        gl: string,
        hl: string
    )
}