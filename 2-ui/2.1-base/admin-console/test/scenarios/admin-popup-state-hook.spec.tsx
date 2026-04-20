import React from 'react'
import {describe, expect, it} from 'vitest'
import {act} from 'react-test-renderer'
import {
    renderWithStore,
    createAdminConsoleHarness,
} from '../support/adminConsoleHarness'
import {
    selectAdminConsoleSelectedTab,
    useAdminPopupState,
} from '../../src'

describe('useAdminPopupState', () => {
    it('keeps setSelectedTab stable across local state rerenders and still updates store state', async () => {
        const harness = await createAdminConsoleHarness()
        let popupState: ReturnType<typeof useAdminPopupState> | undefined

        const Probe: React.FC = () => {
            popupState = useAdminPopupState()
            return null
        }

        await act(async () => {
            renderWithStore(<Probe />, harness.store, harness.runtime)
        })

        expect(popupState?.password).toBe('')
        const initialSetSelectedTab = popupState?.setSelectedTab

        act(() => {
            popupState?.setPassword('654321')
        })

        expect(popupState?.password).toBe('654321')
        expect(popupState?.setSelectedTab).toBe(initialSetSelectedTab)

        act(() => {
            popupState?.setSelectedTab('adapter')
        })

        expect(selectAdminConsoleSelectedTab(harness.store.getState())).toBe('adapter')
    })
})
