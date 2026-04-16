import {describe, expect, it, vi} from 'vitest'
import {
    createAdminConnectorHost,
    createAdminControlHost,
    createAdminDeviceHost,
    createAdminHostTools,
    createAdminLogHost,
} from '../../src'

describe('admin host tools factory', () => {
    it('maps platform and legacy-style device sources into admin snapshots', async () => {
        const host = createAdminDeviceHost({
            getDeviceId: vi.fn().mockResolvedValue('DEVICE-001'),
            getPlatform: vi.fn().mockResolvedValue('android'),
            getModel: vi.fn().mockResolvedValue('PAX-A920'),
            getDeviceInfo: vi.fn().mockResolvedValue({
                manufacturer: 'PAX',
                osVersion: '14',
                displays: [{id: 'main'}],
            }),
            getSystemStatus: vi.fn().mockResolvedValue({
                cpu: {app: 12, cores: 8},
                memory: {app: 128, total: 4096},
                disk: {available: 64, total: 128},
                power: {powerConnected: true, batteryLevel: 88},
                usbDevices: [{name: 'usb-device-1'}],
                bluetoothDevices: [],
                serialDevices: [],
                networks: [{name: 'wifi'}],
                installedApps: [{appName: 'POS'}],
                updatedAt: 1_776_000_000_000,
            }),
        })

        const snapshot = await host.getSnapshot()

        expect(snapshot.identity).toContainEqual({key: 'deviceId', label: '设备ID', value: 'DEVICE-001'})
        expect(snapshot.identity).toContainEqual({key: 'platform', label: '平台', value: 'android'})
        expect(snapshot.runtime).toContainEqual({key: 'displayCount', label: '屏幕数量', value: 1})
        expect(snapshot.peripherals?.map(item => [item.key, item.value])).toContainEqual(['usb', '1'])
        expect(snapshot.resourceDetails?.usbDevices?.[0]).toMatchObject({name: 'usb-device-1'})
        expect(snapshot.resourceDetails?.networks?.[0]).toMatchObject({name: 'wifi'})
    })

    it('maps old logger file operations into the admin log host contract', async () => {
        const source = {
            getLogFiles: vi.fn().mockResolvedValue([
                {fileName: 'app.log', fileSize: 1024, lastModified: 1},
            ]),
            getLogContent: vi.fn().mockResolvedValue('content'),
            deleteLogFile: vi.fn().mockResolvedValue(true),
            clearAllLogs: vi.fn().mockResolvedValue(true),
            getLogDirPath: vi.fn().mockResolvedValue('/logs'),
        }
        const host = createAdminLogHost(source)

        expect(await host.listFiles()).toEqual([
            {fileName: 'app.log', fileSizeBytes: 1024, lastModifiedAt: 1},
        ])
        expect(await host.readFile('app.log')).toBe('content')
        await host.deleteFile('app.log')
        await host.clearAll()
        expect(await host.getDirectoryPath()).toBe('/logs')
        expect(source.deleteLogFile).toHaveBeenCalledWith('app.log')
    })

    it('keeps app-control host optional and exposes only supported actions', async () => {
        const source = {
            restartApp: vi.fn().mockResolvedValue(undefined),
            clearDataCache: vi.fn().mockResolvedValue(undefined),
            switchServerSpace: vi.fn().mockResolvedValue(undefined),
            getServerSpaceSnapshot: vi.fn().mockResolvedValue({
                selectedSpace: 'prod',
                availableSpaces: ['prod', 'dev'],
            }),
        }
        const host = createAdminControlHost(source)

        expect(await host.getSnapshot()).toEqual({
            isFullScreen: undefined,
            isAppLocked: undefined,
            selectedSpace: 'prod',
            availableSpaces: ['prod', 'dev'],
            supportsRestart: true,
            supportsClearCache: true,
            supportsLockControl: false,
            supportsFullScreenControl: false,
        })

        expect(host.setFullScreen).toBeUndefined()
        await host.restartApp?.()
        await host.clearCache?.()
        await host.switchServerSpace?.('dev')
        expect(source.restartApp).toHaveBeenCalledTimes(1)
        expect(source.clearDataCache).toHaveBeenCalledTimes(1)
        expect(source.switchServerSpace).toHaveBeenCalledWith('dev')
    })

    it('builds connector channels from static definitions and dynamic targets', async () => {
        const connector = {
            getAvailableTargets: vi.fn().mockResolvedValue(['/dev/ttyS0']),
            isAvailable: vi.fn().mockResolvedValue(true),
        }
        const host = createAdminConnectorHost({
            connector,
            channels: [
                {
                    key: 'serial',
                    title: '串口',
                    type: 'SERIAL',
                    target: '/dev/fallback',
                    detail: 'serial probe',
                },
            ],
        })

        const channels = await host.getChannels()
        const result = await host.probe('serial:/dev/ttyS0')

        expect(channels.map(channel => channel.key)).toEqual(['serial', 'serial:/dev/ttyS0'])
        expect(result).toEqual({
            channelKey: 'serial:/dev/ttyS0',
            tone: 'ok',
            message: '通道可用',
        })
        expect(connector.isAvailable).toHaveBeenCalledWith({
            type: 'SERIAL',
            target: '/dev/ttyS0',
            mode: 'request-response',
        })
    })

    it('creates a partial host tool bundle from platform ports and explicit extras', () => {
        const tools = createAdminHostTools({
            platformPorts: {
                device: {
                    getDeviceId: vi.fn(),
                    getPlatform: vi.fn(),
                },
                appControl: {
                    restartApp: vi.fn(),
                },
            },
            logs: {
                getLogFiles: vi.fn(),
                getLogContent: vi.fn(),
                deleteLogFile: vi.fn(),
                clearAllLogs: vi.fn(),
                getLogDirPath: vi.fn(),
            },
        })

        expect(tools.device).toBeTruthy()
        expect(tools.control).toBeTruthy()
        expect(tools.logs).toBeTruthy()
        expect(tools.connector).toBeUndefined()
    })
})
