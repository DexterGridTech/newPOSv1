import {describe, expect, it, vi} from 'vitest'
import {
    adminConsoleDefaultConnectorChannels,
    createAdminConsoleModuleInputFromHost,
} from '../../src'

describe('admin console module input factory', () => {
    it('builds module input directly from host adapters', () => {
        const device = {getDeviceInfo: vi.fn(), getSystemStatus: vi.fn()}
        const logs = {
            getLogFiles: vi.fn(),
            getLogContent: vi.fn(),
            deleteLogFile: vi.fn(),
            clearAllLogs: vi.fn(),
            getLogDirPath: vi.fn(),
        }
        const control = {
            restartApp: vi.fn(),
            setFullScreen: vi.fn(),
        }
        const connector = {
            isAvailable: vi.fn(),
            getAvailableTargets: vi.fn(),
        }
        const tdp = {
            getOperationsSnapshot: vi.fn(),
        }

        const moduleInput = createAdminConsoleModuleInputFromHost({
            device,
            logs,
            control,
            connector,
            tdp,
        })

        expect(moduleInput.hostToolSources?.device).toBe(device)
        expect(moduleInput.hostToolSources?.logs).toBe(logs)
        expect(moduleInput.hostToolSources?.control).toBe(control)
        expect(moduleInput.hostToolSources?.connector).toBe(connector)
        expect(moduleInput.hostToolSources?.tdp).toBe(tdp)
        expect(moduleInput.hostToolSources?.connectorChannels).toEqual(adminConsoleDefaultConnectorChannels)
    })

    it('allows overriding connector channel definitions', () => {
        const connector = {
            call: vi.fn(),
        }
        const customChannels = [
            {
                key: 'camera',
                title: '摄像头扫码',
                type: 'SDK',
                action: 'scan',
            },
        ] as const

        const moduleInput = createAdminConsoleModuleInputFromHost({
            connector,
            connectorChannels: customChannels,
        })

        expect(moduleInput.hostToolSources?.connectorChannels).toEqual(customChannels)
    })
})
