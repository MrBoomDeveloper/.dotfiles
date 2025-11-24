export class YouTubeClient {
    constructor(
        clientName: string,
        clientVersion: string,
        clientId: string,''
    ) {

    }
}

const YouTubeClients = {
    WEB_REMIX: new YouTubeClient(
        clientName = "WEB_REMIX",
        clientVersion = "1.20250310.01.00",
        clientId = "67",
        userAgent = USER_AGENT_WEB,
        loginSupported = true,
        useSignatureTimestamp = true,
    )
}