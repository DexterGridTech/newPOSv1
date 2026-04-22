import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createSocketLifecycleController} from '../../src'

describe('transport-runtime socket lifecycle controller', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    it('prevents reconnect after manual stop', async () => {
        let handlers:
            | Parameters<Parameters<typeof createSocketLifecycleController>[0]['attachListeners']>[0]
            | undefined
        const connect = vi.fn(async () => {})
        const disconnect = vi.fn()

        const controller = createSocketLifecycleController({
            connect,
            disconnect,
            attachListeners(nextHandlers) {
                handlers = nextHandlers
            },
            resolveReconnectPolicy() {
                return {attempts: 3, delayMs: 50}
            },
            shouldReconnect() {
                return true
            },
        })

        controller.attach()
        controller.stop('manual-stop')
        handlers?.disconnected('socket-close')
        await vi.advanceTimersByTimeAsync(100)

        expect(disconnect).toHaveBeenCalledWith('manual-stop')
        expect(connect).not.toHaveBeenCalled()
        expect(controller.getReconnectAttempt()).toBe(0)
    })

    it('gives up when reconnect attempts limit is reached', async () => {
        let handlers:
            | Parameters<Parameters<typeof createSocketLifecycleController>[0]['attachListeners']>[0]
            | undefined
        const connect = vi.fn(async () => {})
        const onReconnectGiveUp = vi.fn()

        const controller = createSocketLifecycleController({
            connect,
            disconnect() {},
            attachListeners(nextHandlers) {
                handlers = nextHandlers
            },
            resolveReconnectPolicy() {
                return {attempts: 1, delayMs: 20}
            },
            shouldReconnect() {
                return true
            },
            onReconnectGiveUp,
        })

        controller.attach()
        handlers?.disconnected('first-close')
        await vi.advanceTimersByTimeAsync(20)
        expect(connect).toHaveBeenCalledTimes(1)

        handlers?.disconnected('second-close')
        await vi.advanceTimersByTimeAsync(20)

        expect(connect).toHaveBeenCalledTimes(1)
        expect(onReconnectGiveUp).toHaveBeenCalledWith({
            reason: 'second-close',
            attempt: 1,
            attempts: 1,
        })
    })

    it('restart clears pending reconnect timer and starts a fresh connect', async () => {
        let handlers:
            | Parameters<Parameters<typeof createSocketLifecycleController>[0]['attachListeners']>[0]
            | undefined
        const connect = vi.fn(async () => {})
        const disconnect = vi.fn()

        const controller = createSocketLifecycleController({
            connect,
            disconnect,
            attachListeners(nextHandlers) {
                handlers = nextHandlers
            },
            resolveReconnectPolicy() {
                return {attempts: 3, delayMs: 100}
            },
            shouldReconnect() {
                return true
            },
        })

        controller.attach()
        handlers?.disconnected('need-reconnect')
        expect(controller.getReconnectAttempt()).toBe(1)

        await controller.restart('force-restart')
        await vi.advanceTimersByTimeAsync(150)

        expect(disconnect).toHaveBeenCalledWith('force-restart')
        expect(connect).toHaveBeenCalledTimes(1)
    })

    it('disconnects stale connection after a newer start supersedes it', async () => {
        let resolveFirstConnect: (() => void) | undefined
        const connect = vi.fn(() => new Promise<void>(resolve => {
            if (!resolveFirstConnect) {
                resolveFirstConnect = resolve
                return
            }
            resolve()
        }))
        const disconnect = vi.fn()

        const controller = createSocketLifecycleController({
            connect,
            disconnect,
            attachListeners() {},
            resolveReconnectPolicy() {
                return {attempts: 0, delayMs: 10}
            },
            shouldReconnect() {
                return true
            },
        })

        const firstStart = controller.start()
        const secondStart = controller.start()
        resolveFirstConnect?.()
        await firstStart
        await secondStart

        expect(connect).toHaveBeenCalledTimes(2)
        expect(disconnect).toHaveBeenCalledWith('stale-connect')
    })

    it('schedules reconnect on disconnect and error, then resets attempts on connected', async () => {
        let handlers:
            | Parameters<Parameters<typeof createSocketLifecycleController>[0]['attachListeners']>[0]
            | undefined
        const connect = vi.fn(async () => {})

        const controller = createSocketLifecycleController({
            connect,
            disconnect() {},
            attachListeners(nextHandlers) {
                handlers = nextHandlers
            },
            resolveReconnectPolicy() {
                return {attempts: 3, delayMs: 25}
            },
            shouldReconnect() {
                return true
            },
        })

        controller.attach()

        handlers?.error(new Error('boom'))
        expect(controller.getReconnectAttempt()).toBe(1)
        await vi.advanceTimersByTimeAsync(25)
        expect(connect).toHaveBeenCalledTimes(1)

        handlers?.connected()
        expect(controller.getReconnectAttempt()).toBe(0)

        handlers?.disconnected('drop')
        expect(controller.getReconnectAttempt()).toBe(1)
        await vi.advanceTimersByTimeAsync(25)
        expect(connect).toHaveBeenCalledTimes(2)
    })

    it('schedules reconnect when initial connect throws before any socket event arrives', async () => {
        const connect = vi.fn()
            .mockRejectedValueOnce(new Error('dial failed'))
            .mockResolvedValueOnce(undefined)
        const onConnectFailed = vi.fn()
        const onReconnectScheduled = vi.fn()

        const controller = createSocketLifecycleController({
            connect,
            disconnect() {},
            attachListeners() {},
            resolveReconnectPolicy() {
                return {attempts: 3, delayMs: 25}
            },
            shouldReconnect() {
                return true
            },
            onConnectFailed,
            onReconnectScheduled,
        })

        await expect(controller.start()).resolves.toBeUndefined()

        expect(connect).toHaveBeenCalledTimes(1)
        expect(onConnectFailed).toHaveBeenCalledTimes(1)
        expect(onConnectFailed.mock.calls[0]?.[0]).toMatchObject({
            isReconnect: false,
        })
        expect(onReconnectScheduled).toHaveBeenCalledWith({
            reason: 'dial failed',
            attempt: 1,
            delayMs: 25,
        })
        expect(controller.getReconnectAttempt()).toBe(1)

        await vi.advanceTimersByTimeAsync(25)
        expect(connect).toHaveBeenCalledTimes(2)
    })

    it('rethrows initial connect failure when connect error is marked non-retriable', async () => {
        const connect = vi.fn().mockRejectedValue(new Error('credential missing'))
        const onReconnectScheduled = vi.fn()

        const controller = createSocketLifecycleController({
            connect,
            disconnect() {},
            attachListeners() {},
            resolveReconnectPolicy() {
                return {attempts: 3, delayMs: 25}
            },
            shouldReconnect() {
                return true
            },
            shouldReconnectOnConnectError() {
                return false
            },
            onReconnectScheduled,
        })

        await expect(controller.start()).rejects.toThrow('credential missing')
        expect(onReconnectScheduled).not.toHaveBeenCalled()
        expect(connect).toHaveBeenCalledTimes(1)
        expect(controller.getReconnectAttempt()).toBe(0)
    })
})
