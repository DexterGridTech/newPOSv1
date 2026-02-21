import {NativeModules} from 'react-native'
import {ExternalCall} from '@impos2/kernel-core-base'
import {CallType, ExternalCallRequest, ExternalCallResponse} from '@impos2/kernel-core-base'

const {ExternalCallTurboModule} = NativeModules

export const externalCallAdapter: ExternalCall = {
    async call<T>(request: ExternalCallRequest): Promise<ExternalCallResponse<T>> {
        const req = {
            requestId: request.requestId ?? String(Date.now()),
            type: request.type,
            method: request.method,
            target: request.target,
            action: request.action,
            params: request.params ?? {},
            timeout: request.timeout ?? 30000,
            options: request.options ?? {},
        }
        return ExternalCallTurboModule.call(JSON.stringify(req))
    },

    async isAvailable(type: CallType, target: string): Promise<boolean> {
        return ExternalCallTurboModule.isAvailable(type, target)
    },

    async getAvailableTargets(type: CallType): Promise<string[]> {
        return ExternalCallTurboModule.getAvailableTargets(type)
    },

    async cancel(requestId?: string): Promise<void> {
        return ExternalCallTurboModule.cancel(requestId ?? '')
    },
}
