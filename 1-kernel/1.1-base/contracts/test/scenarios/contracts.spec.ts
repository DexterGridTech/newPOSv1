import {describe, expect, it} from 'vitest'
import {
    INTERNAL_REQUEST_ID,
    createAppError,
    createCommandId,
    createRequestId,
    createRuntimeInstanceId,
    formatTimestampMs,
    integerAtLeast,
    nonEmptyString,
    nowTimestampMs,
    packageVersion,
    positiveFiniteNumber,
    protocolVersion,
} from '../../src'

describe('kernel-base-contracts', () => {
    it('provides runtime id helpers and package metadata', () => {
        expect(packageVersion).toBeTruthy()
        expect(protocolVersion).toBeTruthy()
        expect(INTERNAL_REQUEST_ID).toBeTruthy()
        expect(createRuntimeInstanceId()).toMatch(/^run_/)
        expect(createRequestId()).toMatch(/^req_/)
        expect(createCommandId()).toMatch(/^cmd_/)
    })

    it('formats timestamps and renders app errors with bound context', () => {
        const requestId = createRequestId()
        const commandId = createCommandId()
        const timestamp = new Date('2026-04-07T09:08:07.006Z').getTime() as any

        expect(timestamp).toBeTypeOf('number')
        expect(formatTimestampMs(timestamp)).toMatch(/^2026-04-07 \d{2}:\d{2}:\d{2} 006$/)

        const appError = createAppError(
            {
                key: 'kernel.base.contracts.test_error',
                name: 'Test Error',
                defaultTemplate: 'request ${requestId} failed',
                category: 'SYSTEM',
                severity: 'LOW',
            },
            {
                args: {requestId},
                context: {requestId, commandId},
            },
        )

        expect(appError.requestId).toBe(requestId)
        expect(appError.commandId).toBe(commandId)
        expect(appError.message).toBe(`request ${requestId} failed`)
    })

    it('exposes reusable validators for common business definitions', () => {
        expect(positiveFiniteNumber(1)).toBe(true)
        expect(positiveFiniteNumber(0)).toBe(false)
        expect(positiveFiniteNumber(Number.MIN_VALUE)).toBe(true)
        expect(integerAtLeast(2)(2)).toBe(true)
        expect(integerAtLeast(2)(1)).toBe(false)
        expect(nonEmptyString('ok')).toBe(true)
        expect(nonEmptyString('   ')).toBe(false)
    })

    it('creates ids with stable prefixes and long random suffixes', () => {
        const requestId = createRequestId()
        const commandId = createCommandId()

        expect(requestId).toMatch(/^req_[a-z0-9]+_[a-z0-9]{16}$/)
        expect(commandId).toMatch(/^cmd_[a-z0-9]+_[a-z0-9]{16}$/)
        expect(requestId).not.toBe(commandId)
    })
})
