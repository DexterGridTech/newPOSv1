import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {act} from 'react-test-renderer'
import {InputField} from '@impos2/ui-base-input-runtime'
import {AdminPopup, createAdminPasswordVerifier} from '../../src'
import {createAdminConsoleHarness, renderWithStore} from '../support/adminConsoleHarness'

vi.mock('react-native-qrcode-svg', async () => {
    const ReactModule = await import('react')
    const MockQrCode = (props: Record<string, unknown>) =>
        ReactModule.createElement('mock-qr-code', {
            ...props,
            testID: 'ui-base-admin-popup:device-id-qr',
        })
    return {
        default: MockQrCode,
    }
})

describe('AdminPopup', () => {
    it('renders the protected login view by default', async () => {
        const harness = await createAdminConsoleHarness()
        const tree = renderWithStore(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness.store,
            harness.runtime,
        )

        expect(tree.toJSON()).toBeTruthy()
    })

    it('shows device id text and qr code on the login view without the removed helper sentence', async () => {
        const harness = await createAdminConsoleHarness()
        const tree = renderWithStore(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness.store,
            harness.runtime,
        )

        expect(() => tree.root.findByProps({testID: 'ui-base-admin-popup:device-identity'})).not.toThrow()
        expect(tree.root.findByProps({testID: 'ui-base-admin-popup:device-id'}).props.children).toBe('DEVICE-001')
        expect(() => tree.root.findByProps({testID: 'ui-base-admin-popup:device-id-qr'})).not.toThrow()
        expect(() => tree.root.findByProps({
            children: '管理员可通过设备 ID 扫码或人工录入后生成动态密码。',
        })).not.toThrow()
        expect(() => tree.root.findByProps({
            children: '通过本机 ID 与当前小时生成的动态密码进入工作台。',
        })).toThrow()
    })

    it('shows current password hint in DEV environment only', async () => {
        const harness = await createAdminConsoleHarness({
            platformPorts: {
                environmentMode: 'DEV',
            },
        })
        const tree = renderWithStore(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness.store,
            harness.runtime,
        )
        const verifierPassword = createAdminPasswordVerifier({
            deviceIdProvider: () => 'DEVICE-001',
        }).deriveFor(new Date())

        expect(tree.root.findByType(InputField).props.placeholder).toBe(`开发密码提示：${verifierPassword}`)
    })

    it('keeps login hint generic outside DEV environment', async () => {
        const harness = await createAdminConsoleHarness({
            platformPorts: {
                environmentMode: 'TEST',
            },
        })
        const tree = renderWithStore(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness.store,
            harness.runtime,
        )

        expect(tree.root.findByType(InputField).props.placeholder).toBe('请输入 6 位动态密码')
    })

    it('renders grouped admin navigation and adapter diagnostics after login', async () => {
        const harness = await createAdminConsoleHarness()
        const tree = renderWithStore(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness.store,
            harness.runtime,
        )
        const root = tree.root
        const verifierPassword = createAdminPasswordVerifier({
            deviceIdProvider: () => 'DEVICE-001',
        }).deriveFor(new Date())

        await act(async () => {
            expect(root.findByProps({testID: 'ui-base-admin-popup:password'})).toBeTruthy()
        })

        await act(async () => {
            const passwordInput = root.findByType(InputField)
            passwordInput.props.onChangeText(verifierPassword)
        })

        await act(async () => {
            root.findByProps({testID: 'ui-base-admin-popup:submit'}).props.onPress()
        })

        expect(() => root.findByProps({testID: 'ui-base-admin-popup:panel'})).not.toThrow()
        expect(() => root.findByProps({testID: 'ui-base-admin-popup:group:runtime'})).not.toThrow()
        expect(() => root.findByProps({testID: 'ui-base-admin-popup:group:adapter'})).not.toThrow()
        expect(root.findByProps({testID: 'ui-base-admin-popup:selected-tab'}).props.children).toBe('terminal')

        await act(async () => {
            root.findByProps({testID: 'ui-base-admin-popup:tab:adapter'}).props.onPress()
        })

        expect(() => root.findByProps({testID: 'ui-base-admin-adapter-diagnostics'})).not.toThrow()
        expect(() => root.findByProps({
            children: '等待业务注入测试场景',
        })).not.toThrow()
    })
})
