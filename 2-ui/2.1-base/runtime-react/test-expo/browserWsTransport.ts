import type {
    SocketTransport,
    SocketTransportConnection,
    SocketResolvedConnection,
    SocketConnectionHandlers,
} from '@impos2/kernel-base-transport-runtime'

/**
 * 设计意图：
 * 这是 test-expo 专用的浏览器 WS transport。
 * runtime-react 生产代码不依赖浏览器 WebSocket；只有 Expo Web 自动化测试才通过它接入真实 dual-topology-host-v3。
 */
export const createBrowserWsTransport = (): SocketTransport => {
    return {
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

            const transportConnection: SocketTransportConnection = {
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

            return transportConnection
        },
    }
}
