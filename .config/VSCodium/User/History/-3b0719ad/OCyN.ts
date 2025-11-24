export class YouTubeApi {
    cookies: string;
    locale: YouTubeLocale;
    visitorData: string | null;
    dataSyncId: string | null;
    clientName: String,
    clientVersion: String,
    clientId: String,
    userAgent: String,
    osName: String? = null,
    osVersion: String? = null,
    deviceMake: String? = null,
    deviceModel: String? = null,
    androidSdkVersion: String? = null,
    buildId: String? = null,
    cronetVersion: String? = null,
    packageName: String? = null,
    friendlyName: String? = null,
    val loginRequired: Boolean = false,
    val useSignatureTimestamp: Boolean = false,
    val isEmbedded: Boolean = false,

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