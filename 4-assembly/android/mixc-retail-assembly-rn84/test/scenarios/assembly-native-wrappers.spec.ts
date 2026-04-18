import {beforeEach, describe, expect, it, vi} from 'vitest'

type Listener = (event: Record<string, unknown>) => void

const {
    connectorCallMock,
    connectorSubscribeMock,
    connectorUnsubscribeMock,
    connectorIsAvailableMock,
    connectorGetAvailableTargetsMock,
    deviceGetDeviceInfoMock,
    deviceGetSystemStatusMock,
    deviceAddPowerStatusChangeListenerMock,
    deviceRemovePowerStatusChangeListenerMock,
    scriptsExecuteScriptMock,
    scriptsResolveNativeCallMock,
    scriptsRejectNativeCallMock,
    automationStartHostMock,
    automationStopHostMock,
    automationGetStatusMock,
    automationResolveMessageMock,
    automationRejectMessageMock,
    listenersByEvent,
} = vi.hoisted(() => ({
    connectorCallMock: vi.fn(),
    connectorSubscribeMock: vi.fn(),
    connectorUnsubscribeMock: vi.fn(),
    connectorIsAvailableMock: vi.fn(),
    connectorGetAvailableTargetsMock: vi.fn(),
    deviceGetDeviceInfoMock: vi.fn(),
    deviceGetSystemStatusMock: vi.fn(),
    deviceAddPowerStatusChangeListenerMock: vi.fn(),
    deviceRemovePowerStatusChangeListenerMock: vi.fn(),
    scriptsExecuteScriptMock: vi.fn(),
    scriptsResolveNativeCallMock: vi.fn(),
    scriptsRejectNativeCallMock: vi.fn(),
    automationStartHostMock: vi.fn(),
    automationStopHostMock: vi.fn(),
    automationGetStatusMock: vi.fn(),
    automationResolveMessageMock: vi.fn(),
    automationRejectMessageMock: vi.fn(),
    listenersByEvent: new Map<string, Listener[]>(),
}))

vi.mock('react-native', () => ({
    NativeEventEmitter: class MockNativeEventEmitter {
        addListener(eventName: string, listener: Listener) {
            const listeners = listenersByEvent.get(eventName) ?? []
            listeners.push(listener)
            listenersByEvent.set(eventName, listeners)
            return {
                remove: vi.fn(() => {
                    listenersByEvent.set(
                        eventName,
                        (listenersByEvent.get(eventName) ?? []).filter(item => item !== listener),
                    )
                }),
            }
        }
    },
}))

vi.mock('../../src/turbomodules/specs/NativeConnectorTurboModule', () => ({
    default: {
        call: connectorCallMock,
        subscribe: connectorSubscribeMock,
        unsubscribe: connectorUnsubscribeMock,
        isAvailable: connectorIsAvailableMock,
        getAvailableTargets: connectorGetAvailableTargetsMock,
    },
}))

vi.mock('../../src/turbomodules/specs/NativeDeviceTurboModule', () => ({
    default: {
        getDeviceInfo: deviceGetDeviceInfoMock,
        getSystemStatus: deviceGetSystemStatusMock,
        addPowerStatusChangeListener: deviceAddPowerStatusChangeListenerMock,
        removePowerStatusChangeListener: deviceRemovePowerStatusChangeListenerMock,
    },
}))

vi.mock('../../src/turbomodules/specs/NativeScriptsTurboModule', () => ({
    default: {
        executeScript: scriptsExecuteScriptMock,
        resolveNativeCall: scriptsResolveNativeCallMock,
        rejectNativeCall: scriptsRejectNativeCallMock,
    },
}))

vi.mock('../../src/turbomodules/specs/NativeAutomationTurboModule', () => ({
    default: {
        startAutomationHost: automationStartHostMock,
        stopAutomationHost: automationStopHostMock,
        getAutomationHostStatus: automationGetStatusMock,
        resolveAutomationMessage: automationResolveMessageMock,
        rejectAutomationMessage: automationRejectMessageMock,
    },
}))

const emit = (eventName: string, event: Record<string, unknown>) => {
    ;(listenersByEvent.get(eventName) ?? []).forEach(listener => listener(event))
}

describe('assembly native JS wrappers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        listenersByEvent.clear()
        connectorCallMock.mockResolvedValue({success: true})
        connectorSubscribeMock.mockResolvedValue('channel-1')
        connectorUnsubscribeMock.mockResolvedValue(undefined)
        connectorIsAvailableMock.mockResolvedValue(true)
        connectorGetAvailableTargetsMock.mockResolvedValue(['serial-main'])
        deviceGetDeviceInfoMock.mockResolvedValue({id: 'device-1', manufacturer: 'SUNMI'})
        deviceGetSystemStatusMock.mockResolvedValue({power: {batteryLevel: 100}})
        deviceAddPowerStatusChangeListenerMock.mockResolvedValue('power-listener-1')
        deviceRemovePowerStatusChangeListenerMock.mockResolvedValue(undefined)
        scriptsResolveNativeCallMock.mockResolvedValue(undefined)
        scriptsRejectNativeCallMock.mockResolvedValue(undefined)
        scriptsExecuteScriptMock.mockResolvedValue({success: true, resultJson: JSON.stringify('ok')})
        automationStartHostMock.mockResolvedValue(JSON.stringify({host: '127.0.0.1', port: 18584}))
        automationStopHostMock.mockResolvedValue(undefined)
        automationGetStatusMock.mockResolvedValue(JSON.stringify({running: true}))
        automationResolveMessageMock.mockResolvedValue(undefined)
        automationRejectMessageMock.mockResolvedValue(undefined)
    })

    it('exposes connector availability and target probing from the native module', async () => {
        const {nativeConnector} = await import('../../src/turbomodules/connector')
        const channel = {type: 'SERIAL', target: 'serial-main', mode: 'request-response'}

        await expect(nativeConnector.isAvailable(channel)).resolves.toBe(true)
        await expect(nativeConnector.getAvailableTargets('SERIAL')).resolves.toEqual(['serial-main'])

        expect(connectorIsAvailableMock).toHaveBeenCalledWith(JSON.stringify(channel))
        expect(connectorGetAvailableTargetsMock).toHaveBeenCalledWith('SERIAL')
    })

    it('subscribes and removes device power status listeners through the native module', async () => {
        const {nativeDevice} = await import('../../src/turbomodules/device')
        const handler = vi.fn()

        const remove = nativeDevice.addPowerStatusChangeListener(handler)
        await vi.waitFor(() => {
            expect(deviceAddPowerStatusChangeListenerMock).toHaveBeenCalledTimes(1)
        })

        emit('onPowerStatusChanged', {batteryLevel: 88})
        expect(handler).toHaveBeenCalledWith({batteryLevel: 88})

        remove()

        expect(deviceRemovePowerStatusChangeListenerMock).toHaveBeenCalledWith('power-listener-1')
        emit('onPowerStatusChanged', {batteryLevel: 12})
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('passes nativeFunctions to native script execution and resolves native call events', async () => {
        scriptsExecuteScriptMock.mockImplementation(async () => {
            emit('onNativeCall', {
                callId: 'call-1',
                funcName: 'sum',
                argsJson: JSON.stringify([2, 3]),
            })
            return {success: true, resultJson: JSON.stringify('done')}
        })

        const {nativeScriptExecutor} = await import('../../src/turbomodules/scripts')
        const result = await nativeScriptExecutor.execute({
            source: 'return await sum(2, 3)',
            nativeFunctions: {
                sum: (a: number, b: number) => a + b,
            },
        })

        expect(result).toBe('done')
        expect(scriptsExecuteScriptMock).toHaveBeenCalledWith(
            'return await sum(2, 3)',
            '{}',
            '{}',
            ['sum'],
            5_000,
        )
        expect(scriptsResolveNativeCallMock).toHaveBeenCalledWith('call-1', JSON.stringify(5))
        expect(scriptsRejectNativeCallMock).not.toHaveBeenCalled()
    })

    it('rejects unknown native function calls with a useful error', async () => {
        scriptsExecuteScriptMock.mockImplementation(async () => {
            emit('onNativeCall', {
                callId: 'call-unknown',
                funcName: 'missing',
                argsJson: JSON.stringify([]),
            })
            return {success: true, resultJson: JSON.stringify(null)}
        })

        const {nativeScriptExecutor} = await import('../../src/turbomodules/scripts')
        await nativeScriptExecutor.execute({source: 'return await missing()'})

        expect(scriptsRejectNativeCallMock).toHaveBeenCalledWith(
            'call-unknown',
            'native function is not registered in assembly: missing',
        )
    })

    it('wraps automation host lifecycle and message callbacks', async () => {
        const {nativeAutomationHost} = await import('../../src/turbomodules/automation')
        const listener = vi.fn()
        const unsubscribe = nativeAutomationHost.subscribeMessages(listener)

        await expect(nativeAutomationHost.start({port: 19001})).resolves.toEqual({
            host: '127.0.0.1',
            port: 18584,
        })
        await expect(nativeAutomationHost.getStatus()).resolves.toEqual({running: true})

        emit('onAutomationMessage', {
            callId: 'automation-call-1',
            sessionId: 'session-1',
            messageJson: '{"jsonrpc":"2.0","method":"session.hello","id":1}',
        })
        expect(listener).toHaveBeenCalledWith({
            callId: 'automation-call-1',
            sessionId: 'session-1',
            messageJson: '{"jsonrpc":"2.0","method":"session.hello","id":1}',
        })

        await nativeAutomationHost.resolveMessage('automation-call-1', '{"jsonrpc":"2.0","result":true,"id":1}')
        await nativeAutomationHost.rejectMessage('automation-call-2', 'failed')
        await nativeAutomationHost.stop()
        unsubscribe()

        expect(automationStartHostMock).toHaveBeenCalledWith(JSON.stringify({port: 19001}))
        expect(automationResolveMessageMock).toHaveBeenCalledWith(
            'automation-call-1',
            '{"jsonrpc":"2.0","result":true,"id":1}',
        )
        expect(automationRejectMessageMock).toHaveBeenCalledWith('automation-call-2', 'failed')
        expect(automationStopHostMock).toHaveBeenCalledTimes(1)
    })
})
