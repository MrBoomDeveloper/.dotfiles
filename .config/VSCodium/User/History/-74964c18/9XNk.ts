export class YouTubeClient {
    clientName: string;
    clientVersion: string;
    clientId: string;
    userAgent: string;
    loginSupported: boolean;
    useSignatureTimestamp: boolean;
    osName: string | null;
    osVersion: string | null;
    // deviceMake: String? = null;
    // deviceModel: String? = null;
    // androidSdkVersion: String? = null;
    // buildId: String? = null;
    // cronetVersion: String? = null;
    // packageName: String? = null;
    // friendlyName: String? = null;
    // loginRequired: Boolean = false;
    // useSignatureTimestamp: Boolean = false;
    // isEmbedded: Boolean = false;

    constructor(
        clientName: string,
        clientVersion: string,
        clientId: string,
        userAgent: string,
        loginSupported: boolean,
        useSignatureTimestamp: boolean,
        osName: string | null = null,
        osVersion: string | null = null
    ) {
        this.clientName = clientName;
        this.clientVersion = clientVersion;
        this.clientId = clientId;
        this.userAgent = userAgent;
        this.loginSupported = loginSupported;
        this.useSignatureTimestamp = useSignatureTimestamp;
        this.osName = osName
        this.osVersion = osVersion
    }

    toContext(
        locale: YouTubeLocale, 
        visitorData: string | null, 
        dataSyncId: string | null
    ): any {
        return {
            client: {
                clientName: this.clientName,
                clientVersion: this.clientVersion,
                osName: this.osName,
                osVersion: this.osVersion,
                deviceMake: this.deviceMake,
                deviceModel: this.deviceModel,
                androidSdkVersion: this.androidSdkVersion,
                gl: locale.gl,
                hl: locale.hl,
                visitorData: visitorData
            },
            
            user: {
                onBehalfOfUser: this.loginSupported ? dataSyncId : null
            }
        }
    }
}

export const YouTubeClients = {
    WEB_REMIX: new YouTubeClient(
        "WEB_REMIX",
        "1.20250310.01.00",
        "67",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
        true,
        true,
    )
}