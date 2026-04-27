import React from 'react'
import {describe, expect, it} from 'vitest'
import {act} from 'react-test-renderer'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {
    renderWithStore,
    createAdminConsoleHarness,
} from '../support/adminConsoleHarness'
import {
    getAdminConsoleTabScreenPart,
    selectAdminConsoleSelectedTab,
    useAdminPopupState,
} from '../../src'

describe('useAdminPopupState', () => {
    it('derives selected tab from ui-runtime screen while local setters stay stable', async () => {
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
        expect(popupState?.selectedTab).toBe('terminal')
        const initialSetPassword = popupState?.setPassword

        act(() => {
            popupState?.setPassword('654321')
        })

        expect(popupState?.password).toBe('654321')
        expect(popupState?.setPassword).toBe(initialSetPassword)

        await act(async () => {
            const adapterPart = getAdminConsoleTabScreenPart('adapter')
            await harness.runtime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.replaceScreen,
                {
                    definition: adapterPart.definition,
                    props: {tab: 'adapter'},
                    source: 'admin-popup-state-hook.spec',
                },
            ))
        })

        expect(selectAdminConsoleSelectedTab(harness.store.getState())).toBe('adapter')
        expect(popupState?.selectedTab).toBe('adapter')
    })
})
