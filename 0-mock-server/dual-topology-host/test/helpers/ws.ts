import WebSocket from 'ws'
import type {DualTopologyIncomingMessage, DualTopologyOutgoingMessage} from '../../src'

export interface TestWsClient {
    socket: WebSocket
    waitForMessage(predicate: (message: DualTopologyOutgoingMessage) => boolean, timeoutMs?: number): Promise<DualTopologyOutgoingMessage>
    send(message: DualTopologyIncomingMessage): void
    close(): Promise<void>
    waitForClosed(): Promise<void>
}

export const createTestWsClient = async (url: string): Promise<TestWsClient> => {
    const socket = new WebSocket(url)
    const queue: DualTopologyOutgoingMessage[] = []
    const waiters: Array<{
        predicate: (message: DualTopologyOutgoingMessage) => boolean
        resolve: (message: DualTopologyOutgoingMessage) => void
        reject: (error: Error) => void
        timer: NodeJS.Timeout
    }> = []

    const consume = (message: DualTopologyOutgoingMessage) => {
        const matchedIndex = waiters.findIndex(waiter => waiter.predicate(message))
        if (matchedIndex >= 0) {
            const [waiter] = waiters.splice(matchedIndex, 1)
            clearTimeout(waiter.timer)
            waiter.resolve(message)
            return
        }
        queue.push(message)
    }

    await new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve())
        socket.once('error', error => reject(error))
    })

    socket.on('message', raw => {
        const message = JSON.parse(raw.toString()) as DualTopologyOutgoingMessage
        consume(message)
    })

    return {
        socket,
        waitForMessage(predicate, timeoutMs = 2_000) {
            const queueIndex = queue.findIndex(predicate)
            if (queueIndex >= 0) {
                const [message] = queue.splice(queueIndex, 1)
                return Promise.resolve(message)
            }

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const waiterIndex = waiters.findIndex(waiter => waiter.timer === timer)
                    if (waiterIndex >= 0) {
                        waiters.splice(waiterIndex, 1)
                    }
                    reject(new Error(`Timed out waiting for websocket message within ${timeoutMs}ms`))
                }, timeoutMs)

                waiters.push({
                    predicate,
                    resolve,
                    reject,
                    timer,
                })
            })
        },
        send(message) {
            socket.send(JSON.stringify(message))
        },
        close() {
            return new Promise<void>(resolve => {
                if (socket.readyState === WebSocket.CLOSED) {
                    resolve()
                    return
                }
                socket.once('close', () => resolve())
                socket.close()
            })
        },
        waitForClosed() {
            return new Promise<void>(resolve => {
                if (socket.readyState === WebSocket.CLOSED) {
                    resolve()
                    return
                }
                socket.once('close', () => resolve())
            })
        },
    }
}
