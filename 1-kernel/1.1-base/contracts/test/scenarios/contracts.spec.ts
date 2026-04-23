import {describe, expect, it} from 'vitest'
import {
    INTERNAL_REQUEST_ID,
    createAppError,
    createCommandId,
    createRequestId,
    createRuntimeInstanceId,
    finiteNumberAtLeast,
    formatTimestampMs,
    integerAtLeast,
    isAppError,
    nonNegativeFiniteNumber,
    nonEmptyString,
    nowTimestampMs,
    packageVersion,
    positiveFiniteNumber,
    protocolVersion,
    renderErrorTemplate,
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

    it('renders error templates with repeated placeholders and missing args as empty strings', () => {
        expect(renderErrorTemplate('hello ${name}', {name: 'world'})).toBe('hello world')
        expect(renderErrorTemplate('${name}-${name}-${missing}', {name: 'worker'})).toBe('worker-worker-')
        expect(renderErrorTemplate('request ${requestId} failed')).toBe('request  failed')
        expect(renderErrorTemplate('${x}', undefined)).toBe('')
    })

    it('creates app errors with code fallback and exposes a strict type guard', () => {
        const appError = createAppError({
            key: 'kernel.base.contracts.error.guard',
            name: 'Guard Error',
            defaultTemplate: 'failed',
            category: 'SYSTEM',
            severity: 'LOW',
        })

        expect(appError.code).toBe(appError.key)
        expect(isAppError(appError)).toBe(true)
        expect(isAppError(null)).toBe(false)
        expect(isAppError('error')).toBe(false)
        expect(isAppError({key: 'only-key'})).toBe(false)
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

    it('rejects non-finite values for shared numeric validators', () => {
        expect(finiteNumberAtLeast(3)(3)).toBe(true)
        expect(finiteNumberAtLeast(3)(2.9)).toBe(false)
        expect(finiteNumberAtLeast(3)(Infinity)).toBe(false)
        expect(finiteNumberAtLeast(3)(Number.NaN)).toBe(false)
        expect(nonNegativeFiniteNumber(0)).toBe(true)
        expect(nonNegativeFiniteNumber(-1)).toBe(false)
        expect(nonNegativeFiniteNumber(Infinity)).toBe(false)
    })

    it('creates ids with stable prefixes and long random suffixes', () => {
        const requestId = createRequestId()
        const commandId = createCommandId()

        expect(requestId).toMatch(/^req_[a-z0-9]+_[a-z0-9]{16}$/)
        expect(commandId).toMatch(/^cmd_[a-z0-9]+_[a-z0-9]{16}$/)
        expect(requestId).not.toBe(commandId)
    })
})
