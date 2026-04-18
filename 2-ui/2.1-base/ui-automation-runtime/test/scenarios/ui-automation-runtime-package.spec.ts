import {describe, expect, it} from 'vitest'

describe('ui-automation-runtime package shell', () => {
    it('exports a stable moduleName', async () => {
        const pkg = await import('../../src')
        expect(pkg.moduleName).toBe('ui-base-automation-runtime')
    })
})
