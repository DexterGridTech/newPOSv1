import {describe, expect, it} from 'vitest'
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
})
