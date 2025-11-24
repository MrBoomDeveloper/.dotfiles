export class YouTubeClient {
    constructor(
        clientName: string,
        clientVersion: string,
        clientId: string,
        userAgent: string,
        loginSupported: boolean,
        useSignatureTimestamp: boolean
    ) {

    }
}

const YouTubeClients = {
    WEB_REMIX: new YouTubeClient(
        "WEB_REMIX",
        "1.20250310.01.00",
        "67",
        USER_AGENT_WEB,
        true,
        true,
    )
}