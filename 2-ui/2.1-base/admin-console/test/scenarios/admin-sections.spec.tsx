import React from 'react'
import {Text} from 'react-native'
import {describe, expect, it} from 'vitest'
import {act} from 'react-test-renderer'
import {InputField} from '@impos2/ui-base-input-runtime'
import {
    createAdminPasswordVerifier,
    getAdminConsoleSectionRegistry,
} from '../../src'
import {createAdminConsoleHarness, renderWithStore} from '../support/adminConsoleHarness'
import {AdminPopup} from '../../src'

describe('admin sections', () => {
    it('allows module install to replace default console sections', async () => {
        const customSection = {
            tab: 'terminal' as const,
            group: 'runtime' as const,
            title: '终端管理',
            render: () => <Text testID="ui-base-admin-custom-section">custom-device-section</Text>,
        }

        await createAdminConsoleHarness({
            sections: [customSection],
        })

        const installed = getAdminConsoleSectionRegistry().list()
        expect(installed).toHaveLength(1)
        expect(installed[0]?.tab).toBe('terminal')
    })

    it('renders active section through the registry instead of hardcoded panel logic', async () => {
        const customSection = {
            tab: 'terminal' as const,
            group: 'runtime' as const,
            title: '终端管理',
            render: () => <Text testID="ui-base-admin-custom-section">custom-device-section</Text>,
        }
        const harness = await createAdminConsoleHarness({
            sections: [customSection],
        })
        const tree = renderWithStore(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness.store,
            harness.runtime,
        )
        const password = createAdminPasswordVerifier({
            deviceIdProvider: () => 'DEVICE-001',
        }).deriveFor(new Date())

        await act(async () => {
            tree.root.findByType(InputField).props.onChangeText(password)
        })

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-popup:submit'}).props.onPress()
        })

        expect(() => tree.root.findByProps({testID: 'ui-base-admin-custom-section'})).not.toThrow()
    })
})
