import {NativeEventEmitter} from 'react-native'
import NativeAutomationTurboModule from './specs/NativeAutomationTurboModule'

export const ASSEMBLY_AUTOMATION_MESSAGE_EVENT = 'onAutomationMessage'

export interface NativeAutomationHostAddressInfo {
    host: string
    port: number
}

export interface NativeAutomationMessageEvent {
    callId: string
    sessionId: string
    messageJson: string
}

const emitter = new NativeEventEmitter(NativeAutomationTurboModule as any)

export const nativeAutomationHost = {
    async start(config: Record<string, unknown> = {}): Promise<NativeAutomationHostAddressInfo> {
        return JSON.parse(await NativeAutomationTurboModule.startAutomationHost(JSON.stringify(config))) as NativeAutomationHostAddressInfo
    },
    async stop(): Promise<void> {
        await NativeAutomationTurboModule.stopAutomationHost()
    },
    async getStatus(): Promise<Record<string, unknown>> {
        return JSON.parse(await NativeAutomationTurboModule.getAutomationHostStatus()) as Record<string, unknown>
    },
    subscribeMessages(listener: (event: NativeAutomationMessageEvent) => void): () => void {
        const subscription = emitter.addListener(ASSEMBLY_AUTOMATION_MESSAGE_EVENT, listener)
        return () => subscription.remove()
    },
    async resolveMessage(callId: string, responseJson: string): Promise<void> {
        await NativeAutomationTurboModule.resolveAutomationMessage(callId, responseJson)
    },
    async rejectMessage(callId: string, errorMessage: string): Promise<void> {
        await NativeAutomationTurboModule.rejectAutomationMessage(callId, errorMessage)
    },
}

