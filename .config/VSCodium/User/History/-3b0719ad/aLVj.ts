export class YouTubeApi {
    cookies: string;
    locale: YouTubeLocale;
    visitorData: string | null;
    dataSyncId: string | null;

    clientName: String;
    clientVersion: String;
    clientId: String;
    userAgent: String;
    osName: string | null;
    osVersion: string | null;
    deviceMake: String? = null;
    deviceModel: String? = null;
    androidSdkVersion: String? = null;
    buildId: String? = null;
    cronetVersion: String? = null;
    packageName: String? = null;
    friendlyName: String? = null;
    loginSupported: Boolean = false;
    loginRequired: Boolean = false;
    useSignatureTimestamp: Boolean = false;
    isEmbedded: Boolean = false;

    constructor(
        cookies: string,
        locale: YouTubeLocale,
        visitorData: string | null = null,
        dataSyncId: string | null = null,
        osName: string | null = null,
        osVersion: string | null = null
    ) {
        this.cookies = cookies
        this.locale = locale
        this.visitorData = visitorData
        this.dataSyncId = dataSyncId
        this.osName = osName
        this.osVersion = osVersion
    }
}