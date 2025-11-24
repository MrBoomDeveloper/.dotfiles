export class YouTubeClient {
    clientName: string

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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
        true,
        true,
    )
}