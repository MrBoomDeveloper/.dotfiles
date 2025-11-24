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

    fun toContext(): Record<string, string> {
        
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