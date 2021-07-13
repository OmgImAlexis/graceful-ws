export type WebsocketSettings = {
    protocols?: string | Array<string>;
    url: string;
}

export type Options = {

    // Websocket related settings (https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket)
    ws: WebsocketSettings;

    pingTimeout: number;
    pingInterval: number;
    retryInterval: number;
};
