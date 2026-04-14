import {describe, expect, it} from 'vitest'
import {createCommandId, createRequestId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts, packageVersion, type LogEvent} from '../../src'

describe('kernel-base-platform-ports', () => {
    it('masks sensitive payloads in PROD logger output', () => {
        const events: LogEvent[] = []
        const logger = createLoggerPort({
            environmentMode: 'PROD',
            write: event => {
                events.push(event)
            },
            scope: {
                moduleName: 'kernel.base.platform-ports.test',
                layer: 'kernel',
            },
        })

        logger.info({
            category: 'runtime.lifecycle',
            event: 'test-verification',
            message: 'hello',
            data: {token: 'secret-token'},
        })

        expect(events).toHaveLength(1)
        expect(events[0]?.security.maskingMode).toBe('masked')
        expect(events[0]?.data?.token).toBe('[MASKED]')
        expect(events[0]?.security.containsSensitiveRaw).toBe(true)
    })

    it('creates platform ports with injected adapters intact', async () => {
        const logger = createLoggerPort({
            environmentMode: 'TEST',
            write() {},
            scope: {
                moduleName: 'kernel.base.platform-ports.test',
                layer: 'kernel',
            },
        })

        const ports = createPlatformPorts({
            environmentMode: 'TEST',
            logger,
            scriptExecutor: {
                async execute<T = unknown>() {
                    return {ok: true} as T
                },
            },
        })

        expect(packageVersion).toBeTruthy()
        expect(ports.logger).toBe(logger)
        expect(ports.scriptExecutor).toBeTruthy()
        await expect(ports.scriptExecutor?.execute()).resolves.toEqual({ok: true})
    })

    it('keeps sensitive fields raw outside PROD and merges scope plus context bindings', () => {
        const events: LogEvent[] = []
        const requestId = createRequestId()
        const commandId = createCommandId()
        const logger = createLoggerPort({
            environmentMode: 'DEV',
            write: event => {
                events.push(event)
            },
            scope: {
                moduleName: 'kernel.base.platform-ports.test',
                layer: 'kernel',
            },
            context: {
                requestId,
            },
        })
            .scope({subsystem: 'parent'})
            .scope({component: 'child'})
            .withContext({commandId})

        logger.info({
            category: 'runtime.lifecycle',
            event: 'raw-dev',
            context: {commandName: 'kernel.base.platform-ports.test.raw-dev'},
            data: {
                token: 'secret-token',
                nested: {
                    password: 'secret-password',
                },
            },
        })

        expect(events).toHaveLength(1)
        expect(events[0]?.security.maskingMode).toBe('raw')
        expect(events[0]?.security.containsSensitiveRaw).toBe(true)
        expect(events[0]?.scope).toMatchObject({
            moduleName: 'kernel.base.platform-ports.test',
            layer: 'kernel',
            subsystem: 'parent',
            component: 'child',
        })
        expect(events[0]?.context).toMatchObject({
            requestId,
            commandId,
            commandName: 'kernel.base.platform-ports.test.raw-dev',
        })
        expect(events[0]?.data).toEqual({
            token: 'secret-token',
            nested: {
                password: 'secret-password',
            },
        })
    })

    it('drops array payloads from event.data but still detects sensitive raw values', () => {
        const events: LogEvent[] = []
        const logger = createLoggerPort({
            environmentMode: 'PROD',
            write: event => {
                events.push(event)
            },
            scope: {
                moduleName: 'kernel.base.platform-ports.test',
                layer: 'kernel',
            },
        })

        logger.info({
            category: 'runtime.lifecycle',
            event: 'array-payload',
            data: [{token: 'secret-token'}] as any,
        })

        expect(events).toHaveLength(1)
        expect(events[0]?.data).toBeUndefined()
        expect(events[0]?.security.containsSensitiveRaw).toBe(true)
        expect(events[0]?.security.maskingMode).toBe('masked')
    })

    it('masks circular payloads in PROD without stack overflow', () => {
        const events: LogEvent[] = []
        const logger = createLoggerPort({
            environmentMode: 'PROD',
            write: event => {
                events.push(event)
            },
            scope: {
                moduleName: 'kernel.base.platform-ports.test',
                layer: 'kernel',
            },
        })

        const payload: Record<string, unknown> = {token: 'secret'}
        payload.self = payload

        logger.info({
            category: 'runtime.lifecycle',
            event: 'circular-payload',
            data: payload,
        })

        expect(events[0]?.data?.token).toBe('[MASKED]')
        expect(events[0]?.data?.self).toBe('[CIRCULAR]')
    })

    it('masks nested sensitive fields recursively in PROD', () => {
        const events: LogEvent[] = []
        const logger = createLoggerPort({
            environmentMode: 'PROD',
            write: event => {
                events.push(event)
            },
            scope: {
                moduleName: 'kernel.base.platform-ports.test',
                layer: 'kernel',
            },
        })

        logger.warn({
            category: 'runtime.security',
            event: 'nested-sensitive',
            data: {
                user: {
                    password: 'secret-password',
                },
                payment: {
                    cardToken: 'secret-token',
                },
            },
        })

        expect(events[0]?.data).toEqual({
            user: {
                password: '[MASKED]',
            },
            payment: '[MASKED]',
        })
    })

    it('passes emitted events through without cloning', () => {
        const events: LogEvent[] = []
        const logger = createLoggerPort({
            environmentMode: 'TEST',
            write: event => {
                events.push(event)
            },
            scope: {
                moduleName: 'kernel.base.platform-ports.test',
                layer: 'kernel',
            },
        })

        const originalEvent: LogEvent = {
            timestamp: 1 as any,
            level: 'info',
            category: 'runtime.lifecycle',
            event: 'emit-direct',
            scope: {
                moduleName: 'kernel.base.platform-ports.test',
                layer: 'kernel',
            },
            data: {
                ok: true,
            },
            security: {
                containsSensitiveRaw: false,
                maskingMode: 'raw',
            },
        }

        logger.emit(originalEvent)

        expect(events[0]).toBe(originalEvent)
    })
})
