import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {
    AdminPopup,
    adminConsoleStateActions,
    createAdminPasswordVerifier,
} from '../../src'
import {
    createAdminConsoleHarness,
    renderAdminWithAutomation,
} from '../support/adminConsoleHarness'

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
    const enterPin = async (
        automation: ReturnType<typeof renderAdminWithAutomation>,
        value: string,
    ) => await automation.typeVirtualValue('ui-base-admin-popup:password', value)

    it('renders the protected login view by default', async () => {
        const harness = await createAdminConsoleHarness()
        const tree = renderAdminWithAutomation(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness,
        )

        await expect(tree.getNode('ui-base-admin-popup:login')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-admin-popup:password')).resolves.toBeTruthy()
    })

    it('shows device id text and qr code on the login view without the removed helper sentence', async () => {
        const harness = await createAdminConsoleHarness()
        const tree = renderAdminWithAutomation(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness,
        )

        await expect(tree.getNode('ui-base-admin-popup:device-identity')).resolves.toBeTruthy()
        await expect(tree.getText('ui-base-admin-popup:device-id')).resolves.toBe('DEVICE-001')
        await expect(tree.getNode('ui-base-admin-popup:device-id-qr')).resolves.toBeTruthy()
        await expect(tree.queryNodesByText('管理员可通过设备 ID 扫码或人工录入后生成动态密码。')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('通过本机 ID 与当前小时生成的动态密码进入工作台。')).resolves.toHaveLength(0)
    })

    it('shows current password hint in DEV environment only', async () => {
        const harness = await createAdminConsoleHarness({
            platformPorts: {
                environmentMode: 'DEV',
            },
        })
        const automation = renderAdminWithAutomation(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness,
        )
        const verifierPassword = createAdminPasswordVerifier({
            deviceIdProvider: () => 'DEVICE-001',
        }).deriveFor(new Date())

        expect(await automation.getText('ui-base-admin-popup:password')).toBe(`开发密码提示：${verifierPassword}`)
    })

    it('keeps login hint generic outside DEV environment', async () => {
        const harness = await createAdminConsoleHarness({
            platformPorts: {
                environmentMode: 'TEST',
            },
        })
        const automation = renderAdminWithAutomation(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness,
        )

        expect(await automation.getText('ui-base-admin-popup:password')).toBe('请输入 6 位动态密码')
    })

    it('renders grouped admin navigation and adapter diagnostics after login', async () => {
        const harness = await createAdminConsoleHarness()
        const automation = renderAdminWithAutomation(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness,
        )
        const verifierPassword = createAdminPasswordVerifier({
            deviceIdProvider: () => 'DEVICE-001',
        }).deriveFor(new Date())

        await automation.waitForNode('ui-base-admin-popup:password')
        await enterPin(automation, verifierPassword)
        await automation.press('ui-base-admin-popup:submit')
        await automation.waitForNode('ui-base-admin-popup:panel')

        await expect(automation.getNode('ui-base-admin-popup:group:runtime')).resolves.toBeTruthy()
        await expect(automation.getNode('ui-base-admin-popup:group:adapter')).resolves.toBeTruthy()
        await expect(automation.getText('ui-base-admin-popup:selected-tab')).resolves.toBe('terminal')

        await automation.press('ui-base-admin-popup:tab:adapter')
        await automation.waitForNode('ui-base-admin-adapter-diagnostics')
        await expect(automation.queryNodesByText('等待业务注入测试场景')).resolves.toHaveLength(1)
    })

    it('renders scenario-level adapter diagnostic results after a run summary is stored', async () => {
        const harness = await createAdminConsoleHarness({
            adapterDiagnosticScenarios: [
                {
                    adapterKey: 'device',
                    scenarioKey: 'device-info',
                    title: '设备信息读取',
                    async run() {
                        return {
                            status: 'passed',
                            message: 'ok',
                        }
                    },
                },
            ],
        })
        harness.store.dispatch(adminConsoleStateActions.setLatestAdapterSummary({
            runId: 'run-1',
            status: 'failed',
            total: 2,
            passed: 1,
            failed: 1,
            skipped: 0,
            startedAt: 1,
            finishedAt: 2,
            durationMs: 1,
            results: [
                {
                    adapterKey: 'device',
                    scenarioKey: 'device-info',
                    title: '设备信息读取',
                    status: 'passed',
                    message: '读取正常',
                    startedAt: 1,
                    finishedAt: 2,
                    durationMs: 1,
                },
                {
                    adapterKey: 'device',
                    scenarioKey: 'system-status',
                    title: '系统状态读取',
                    status: 'failed',
                    message: '系统状态失败',
                    startedAt: 3,
                    finishedAt: 4,
                    durationMs: 1,
                },
            ],
        }))
        const automation = renderAdminWithAutomation(
            <AdminPopup deviceId="DEVICE-001" onClose={() => {}} />,
            harness,
        )
        const verifierPassword = createAdminPasswordVerifier({
            deviceIdProvider: () => 'DEVICE-001',
        }).deriveFor(new Date())

        await enterPin(automation, verifierPassword)
        await automation.press('ui-base-admin-popup:submit')
        await automation.press('ui-base-admin-popup:tab:adapter')
        await automation.waitForNode('ui-base-admin-adapter-diagnostics')

        await expect(automation.queryNodesByText('系统状态读取')).resolves.toHaveLength(1)
        await expect(automation.queryNodesByText('系统状态失败')).resolves.toHaveLength(1)
    })
})
