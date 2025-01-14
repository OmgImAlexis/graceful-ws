export type WebsocketSettings = {
    protocols?: string | Array<string>;
    url: string;
    options: Record<string, string>;
}

export type Options = {

    // Websocket related settings (https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket)
    ws: WebsocketSettings;

    retryInterval: number;
};
