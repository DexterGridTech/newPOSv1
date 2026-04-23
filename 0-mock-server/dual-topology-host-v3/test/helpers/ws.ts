import WebSocket from 'ws'
import type {
    DualTopologyHostV3IncomingMessage,
    DualTopologyHostV3OutgoingMessage,
} from '../../src'

export interface TestWsClientV3 {
    waitForMessage(predicate: (message: DualTopologyHostV3OutgoingMessage) => boolean, timeoutMs?: number): Promise<DualTopologyHostV3OutgoingMessage>
    send(message: DualTopologyHostV3IncomingMessage): void
    close(): Promise<void>
}

export const createTestWsClientV3 = async (url: string): Promise<TestWsClientV3> => {
    const socket = new WebSocket(url)
    const queue: DualTopologyHostV3OutgoingMessage[] = []
    const waiters: Array<{
        predicate: (message: DualTopologyHostV3OutgoingMessage) => boolean
        resolve: (message: DualTopologyHostV3OutgoingMessage) => void
        reject: (error: Error) => void
        timer: NodeJS.Timeout
    }> = []

    const consume = (message: DualTopologyHostV3OutgoingMessage) => {
        const waiterIndex = waiters.findIndex(waiter => waiter.predicate(message))
        if (waiterIndex >= 0) {
            const [waiter] = waiters.splice(waiterIndex, 1)
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
        consume(JSON.parse(raw.toString()) as DualTopologyHostV3OutgoingMessage)
    })

    return {
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
    }
}
