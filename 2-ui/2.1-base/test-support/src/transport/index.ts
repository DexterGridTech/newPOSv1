import type {
    HttpTransport,
    HttpTransportRequest,
    SocketConnectionHandlers,
    SocketResolvedConnection,
    SocketTransport,
    SocketTransportConnection,
    TransportServerDefinition,
} from '@next/kernel-base-transport-runtime'

export interface BrowserFetchTransportInput {
    fetchImpl?: typeof fetch
}

export const createBrowserFetchTransport = (
    input: BrowserFetchTransportInput = {},
): HttpTransport => {
    const executeFetch = input.fetchImpl ?? fetch
    return {
        async execute<TPath, TQuery, TBody, TResponse>(
            request: HttpTransportRequest<TPath, TQuery, TBody>,
        ) {
            const response = await executeFetch(request.url, {
                method: request.endpoint.method,
                headers: {
                    'content-type': 'application/json',
                    ...(request.input.headers ?? {}),
                },
                body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
            })
            const text = await response.text()
            const headers: Record<string, string> = {}
            response.headers.forEach((value, key) => {
                headers[key] = value
            })
            return {
                data: text ? JSON.parse(text) as TResponse : undefined as TResponse,
                status: response.status,
                statusText: response.statusText,
                headers,
            }
        },
    }
}

export const createBrowserWsTransport = (): SocketTransport => ({
    async connect<TPath, TQuery, THeaders, TIncoming, TOutgoing>(
        connection: SocketResolvedConnection<TPath, TQuery, THeaders, TIncoming, TOutgoing>,
        handlers: SocketConnectionHandlers,
    ): Promise<SocketTransportConnection> {
        const socket = new WebSocket(connection.url)

        socket.addEventListener('open', () => {
            handlers.onOpen()
        })
        socket.addEventListener('message', event => {
            const raw = typeof event.data === 'string'
                ? event.data
                : String(event.data)
            handlers.onMessage(raw)
        })
        socket.addEventListener('close', event => {
            handlers.onClose(event.reason || `code:${event.code}`)
        })
        socket.addEventListener('error', event => {
            handlers.onError(event)
        })

        if (connection.timeoutMs && connection.timeoutMs > 0) {
            window.setTimeout(() => {
                if (socket.readyState === WebSocket.CONNECTING) {
                    socket.close(4000, 'connection-timeout')
                }
            }, connection.timeoutMs)
        }

        await new Promise<void>((resolve, reject) => {
            socket.addEventListener('open', () => resolve(), {once: true})
            socket.addEventListener('error', event => reject(event), {once: true})
        })

        return {
            sendRaw(payload: string) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(payload)
                }
            },
            disconnect(reason?: string) {
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close(1000, reason)
                }
            },
        }
    },
})

export const overrideServerBaseUrl = (
    servers: readonly TransportServerDefinition[],
    serverName: string,
    baseUrl: string | undefined,
): readonly TransportServerDefinition[] => {
    if (!baseUrl) {
        return servers
    }

    return servers.map(server => {
        if (server.serverName !== serverName) {
            return {
                ...server,
                addresses: server.addresses.map(address => ({...address})),
            }
        }

        const firstAddress = server.addresses[0]
        return {
            ...server,
            addresses: [
                {
                    ...(firstAddress ?? {addressName: 'dynamic'}),
                    baseUrl,
                },
            ],
        }
    })
}
