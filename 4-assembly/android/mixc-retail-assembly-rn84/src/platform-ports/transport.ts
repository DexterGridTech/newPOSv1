import type {
    HttpTransport,
    SocketConnectionHandlers,
    SocketResolvedConnection,
    SocketTransport,
    SocketTransportConnection,
} from '@impos2/kernel-base-transport-runtime'

export const createAssemblyFetchTransport = (): HttpTransport => ({
    async execute(request) {
        const controller = typeof AbortController !== 'undefined' && request.timeoutMs
            ? new AbortController()
            : undefined
        const timeoutId = controller && request.timeoutMs
            ? setTimeout(() => controller.abort(), request.timeoutMs)
            : undefined

        try {
            const response = await fetch(request.url, {
                method: request.endpoint.method,
                headers: {
                    'content-type': 'application/json',
                    ...(request.input.headers ?? {}),
                },
                body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
                signal: controller?.signal,
            })
            const text = await response.text()
            const data = text ? JSON.parse(text) : null
            const headers: Record<string, string> = {}
            response.headers.forEach((value, key) => {
                headers[key] = value
            })
            return {
                data,
                status: response.status,
                statusText: response.statusText,
                headers,
            }
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    },
})

export const createAssemblyWebSocketTransport = (): SocketTransport => ({
    async connect<TPath, TQuery, THeaders, TIncoming, TOutgoing>(
        connection: SocketResolvedConnection<TPath, TQuery, THeaders, TIncoming, TOutgoing>,
        handlers: SocketConnectionHandlers,
    ): Promise<SocketTransportConnection> {
        const parsedUrl = connection.url.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)(\/[^?#]*)?/i)
        if (!parsedUrl?.[2]) {
            throw new Error(`Assembly WebSocket url host is empty: ${connection.url}`)
        }
        console.info('[assembly.android.mixc-retail-rn84.websocket] connect', {
            url: connection.url,
            protocol: parsedUrl[1],
            host: parsedUrl[2],
            pathname: parsedUrl[3] ?? '/',
        })
        const socket = new WebSocket(connection.url)

        socket.onopen = () => {
            handlers.onOpen()
        }
        socket.onmessage = event => {
            handlers.onMessage(typeof event.data === 'string' ? event.data : String(event.data))
        }
        socket.onclose = event => {
            handlers.onClose(event.reason || `code:${event.code}`)
        }
        socket.onerror = event => {
            handlers.onError(event)
        }

        let timeoutId: ReturnType<typeof setTimeout> | undefined
        if (connection.timeoutMs && connection.timeoutMs > 0) {
            timeoutId = setTimeout(() => {
                if (socket.readyState === WebSocket.CONNECTING) {
                    socket.close(4000, 'connection-timeout')
                }
            }, connection.timeoutMs)
        }

        await new Promise<void>((resolve, reject) => {
            const handleOpen = () => {
                socket.removeEventListener('open', handleOpen)
                socket.removeEventListener('error', handleError)
                resolve()
            }
            const handleError = () => {
                socket.removeEventListener('open', handleOpen)
                socket.removeEventListener('error', handleError)
                reject(new Error('websocket connection failed'))
            }
            socket.addEventListener('open', handleOpen)
            socket.addEventListener('error', handleError)
        }).finally(() => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        })

        return {
            sendRaw(payload) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(payload)
                }
            },
            disconnect(reason) {
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close(1000, reason)
                }
            },
        }
    },
})
