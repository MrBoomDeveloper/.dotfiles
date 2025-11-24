export class YouTubeClient {
    clientName: string;
    clientVersion: string;
    clientId: string;
    userAgent: string;
    loginSupported: boolean;
    useSignatureTimestamp: boolean;

    constructor(
        clientName: string,
        clientVersion: string,
        clientId: string,
        userAgent: string,
        loginSupported: boolean,
        useSignatureTimestamp: boolean
    ) {
        this.clientName = clientName;
        this.clientVersion = clientVersion;
        this.clientId = clientId;
        this.userAgent = userAgent;
        this.loginSupported = loginSupported;
        this.useSignatureTimestamp = useSignatureTimestamp;
    }

    function toContext(
        locale: YouTubeLocale, 
        visitorData: string | null, 
        dataSyncId: string | null
    ) = Context(
        client = Context.Client(
            clientName = clientName,
            clientVersion = clientVersion,
            osName = osName,
            osVersion = osVersion,
            deviceMake = deviceMake,
            deviceModel = deviceModel,
            androidSdkVersion = androidSdkVersion,
            gl = locale.gl,
            hl = locale.hl,
            visitorData = visitorData
        ),
        user = Context.User(
            onBehalfOfUser = if (loginSupported) dataSyncId else null
        ),
    )
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