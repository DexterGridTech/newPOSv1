import WebSocket from 'ws'
import type {
    SocketResolvedConnection,
    SocketTransport,
    SocketTransportConnection,
} from '../../src'

export const createNodeWsTransport = (): SocketTransport => {
    return {
        async connect(connection: SocketResolvedConnection<any, any, any, any, any>, handlers) {
            const socket = new WebSocket(connection.url, {
                headers: connection.headers,
                handshakeTimeout: connection.timeoutMs,
            })

            socket.on('open', () => {
                handlers.onOpen()
            })

            socket.on('message', raw => {
                handlers.onMessage(raw.toString())
            })

            socket.on('close', (_code, reason) => {
                handlers.onClose(reason.toString() || undefined)
            })

            socket.on('error', error => {
                handlers.onError(error)
            })

            await new Promise<void>((resolve, reject) => {
                socket.once('open', () => resolve())
                socket.once('error', error => reject(error))
            })

            const transportConnection: SocketTransportConnection = {
                sendRaw(payload: string) {
                    socket.send(payload)
                },
                disconnect(reason?: string) {
                    socket.close(1000, reason)
                },
            }

            return transportConnection
        },
    }
}
