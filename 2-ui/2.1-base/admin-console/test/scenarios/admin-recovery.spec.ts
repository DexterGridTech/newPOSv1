import {describe, expect, it} from 'vitest'
import {createDefaultAdminConsolePersistence} from '../../src'

describe('admin recovery model', () => {
    it('persists only the minimum recoverable admin console state', () => {
        const state = createDefaultAdminConsolePersistence()

        expect(state).toEqual({})
        expect('selectedTab' in state).toBe(false)
        expect('latestAdapterSummary' in state).toBe(false)
    })
})
