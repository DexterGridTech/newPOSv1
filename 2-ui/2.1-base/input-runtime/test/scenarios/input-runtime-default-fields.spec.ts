import {describe, expect, it} from 'vitest'
import {inputRuntimeDefaultFields} from '../../src'

describe('input runtime default fields', () => {
    it('exports default fields with explicit transient persistence', () => {
        expect(inputRuntimeDefaultFields.username.persistence).toBe('transient')
        expect(inputRuntimeDefaultFields.password.persistence).toBe('transient')
        expect(inputRuntimeDefaultFields.phone.persistence).toBe('transient')
        expect(inputRuntimeDefaultFields.smsCode.persistence).toBe('transient')
        expect(inputRuntimeDefaultFields.adminPassword.persistence).toBe('transient')
        expect(inputRuntimeDefaultFields.activationCode.persistence).toBe('transient')
    })
})
