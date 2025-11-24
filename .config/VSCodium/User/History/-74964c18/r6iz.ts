import type { YouTubeApi } from "../youtubeApi";

export class YouTubeClient {
    clientName: string;
    clientVersion: string;
    clientId: string;
    userAgent: string;
    loginSupported: boolean;
    useSignatureTimestamp: boolean;
    osName: string | null;
    osVersion: string | null;
    deviceMake: string | null = null;
    deviceModel: string | null = null;
    androidSdkVersion: string | null = null;
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
        osVersion: string | null = null,
        deviceMake: string | null = null,
        deviceModel: string | null = null,
        androidSdkVersion: string | null = null
    ) {
        this.clientName = clientName;
        this.clientVersion = clientVersion;
        this.clientId = clientId;
        this.userAgent = userAgent;
        this.loginSupported = loginSupported;
        this.useSignatureTimestamp = useSignatureTimestamp;
        this.osName = osName
        this.osVersion = osVersion
        this.deviceMake = deviceMake
        this.deviceModel = deviceModel
        this.androidSdkVersion = androidSdkVersion
    }

    toContext(api: YouTubeApi): any {
        return {
            client: {
                clientName: this.clientName,
                clientVersion: this.clientVersion,
                osName: this.osName,
                osVersion: this.osVersion,
                deviceMake: this.deviceMake,
                deviceModel: this.deviceModel,
                androidSdkVersion: this.androidSdkVersion,
                gl: api.locale.gl,
                hl: api.locale.hl,
                visitorData: api.visitorData
            },
            
            user: {
                onBehalfOfUser: this.loginSupported ? api.dataSyncId : null
            }
        }
    }
}

export const YouTubeClients = {
    WEB_REMIX: new YouTubeClient(
        "WEB_REMIX",
        "1.20251103.03.00",
        "67",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
        true,
        true,
    )
}