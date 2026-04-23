import {describe, expect, it} from 'vitest'
import {createDefaultAdminConsolePersistence} from '../../src'

describe('admin recovery model', () => {
    it('persists only the minimum recoverable admin console state', () => {
        const state = createDefaultAdminConsolePersistence()

        expect(state).toEqual({
            selectedTab: 'terminal',
        })
        expect('latestAdapterSummary' in state).toBe(false)
    })
})
