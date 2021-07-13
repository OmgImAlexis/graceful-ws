import {EventEmitter} from 'events';
import WebSocket from 'ws';
import type {Options} from './types';

export default class GracefulWebSocket extends EventEmitter {
    // Default options
    readonly #_options: Options = {
        ws: {
            protocols: [],
            url: '',
            options: {}
        },
        pingInterval: 5000,
        pingTimeout: 2500,
        retryInterval: 1000
    };

    // Instance stuff
    #_closed = false;
    #_websocket: WebSocket | null = null;
    #_connected = false;

    // Timing id's
    #_disconnectionTimeoutId?: ReturnType<typeof setTimeout>;
    #_pingingTimeoutId?: ReturnType<typeof setInterval>;
    #_retryIntervalId?: ReturnType<typeof setInterval>;

    constructor(
        url: string,
        protocols: Array<string>,
        options: Record<string, string>
    ) {
        super();

        this.#_options.ws = {
            url,
            protocols,
            options
        };

        if (!this.#_options.ws || !this.#_options.ws.url) {
            throw new Error('You must provide at least a websocket url.');
        }

        this.#_websocket = null;
        this.start();
    }

    get pingInterval(): number {
        return this.#_options.pingInterval;
    }

    set pingInterval(value: number) {
        this.#_options.pingInterval = value;
    }

    get pingTimeout(): number {
        return this.#_options.pingTimeout;
    }

    set pingTimeout(value: number) {
        this.#_options.pingTimeout = value;
    }

    get retryInterval(): number {
        return this.#_options.retryInterval;
    }

    set retryInterval(value: number) {
        this.#_options.retryInterval = value;
    }

    get bufferedAmount(): number | null {
        return this.#_websocket ? this.#_websocket.bufferedAmount : null;
    }

    get extensions(): string | null {
        return this.#_websocket ? this.#_websocket.extensions : null;
    }

    get protocol(): string | null {
        return this.#_websocket ? this.#_websocket.protocol : null;
    }

    get readyState(): number | null {
        return this.#_websocket ? this.#_websocket.readyState : null;
    }

    get url(): string | null {
        return this.#_websocket ? this.#_websocket.url : null;
    }

    // Custom properties
    get connected(): boolean {
        return this.#_connected;
    }

    public send(data: string | ArrayBufferLike | ArrayBufferView): void {
        if (this.#_websocket) {
            this.#_websocket.send(data);
        } else {
            throw new Error('Websocket isn\'t created yet.');
        }
    }

    public close(code?: number, reason?: string): void {
        if (this.#_closed) {
            throw new Error('Websocket already closed.');
        } else if (this.#_websocket) {
            this.#_closed = true;

            // Clear retry-interval if currently in a pending state
            if (this.#_retryIntervalId) clearInterval(this.#_retryIntervalId);

            // Close websocket
            this.#_websocket.close(code, reason);

            // Dispatch close event
            this.emit('killed');
        } else {
            throw new Error('Websocket isn\'t created yet.');
        }
    }

    private start(): void {
        const { pingInterval, pingTimeout, ws: { url, protocols, options } } = this.#_options;
        const ws = this.#_websocket = new WebSocket(url, protocols || [], options);

        ws.addEventListener('open', () => {
            // Update connection state and dispatch event
            this.#_connected = true;
            this.emit('connected');

            // Ping every 5s
            this.#_pingingTimeoutId = setInterval(() => {
                this.#_disconnectionTimeoutId = setTimeout(() => {
                    ws.close();
                }, pingTimeout);
            }, pingInterval);
        });

        ws.addEventListener('message', e => {
            // Check if message is a keep alive, if so stop propagation
            if (e.data === 'ka') {
                if (this.#_disconnectionTimeoutId) clearTimeout(this.#_disconnectionTimeoutId);
            } else {
                this.emit('message', e);
            }
        });

        ws.addEventListener('close', () => {
            // Clear timeouts
            if (this.#_disconnectionTimeoutId) clearTimeout(this.#_disconnectionTimeoutId);
            if (this.#_pingingTimeoutId) clearTimeout(this.#_pingingTimeoutId);

            // Restart if not manually closed
            if (!this.#_closed) {
                this.restart();
            }
        });

        ws.on('unexpected-response', (request, response) => {
            this.emit('unexpected-response', request, response);
        });
    }

    private restart(): void {
        const wasConnected = this.#_connected;
        this.#_connected = false;

        // Dispatch custom event if it was connected previously
        if (wasConnected) {
            this.emit('disconnected');
        }

        // Check every second if internet is available
        this.#_retryIntervalId = setInterval(() => {
            if (this.#_retryIntervalId) clearInterval(this.#_retryIntervalId);
            this.start();
        }, this.#_options.retryInterval);
    }
}
