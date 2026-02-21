import {CallType, ExternalCallRequest, ExternalCallResponse} from "../../types";

export interface ExternalCall {
    /**
     * 通用调用方法
     * 这是核心方法，所有外部调用都通过这个方法
     * @param request 调用请求
     * @returns Promise<ExternalCallResponse>
     */
    call<T = any>(request: ExternalCallRequest): Promise<ExternalCallResponse<T>>;

    /**
     * 检查目标是否可用
     * @param type 调用类型
     * @param target 目标标识
     */
    isAvailable(type: CallType, target: string): Promise<boolean>;

    /**
     * 获取已注册的目标列表
     * @param type 调用类型
     */
    getAvailableTargets(type: CallType): Promise<string[]>;

    /**
     * 取消正在进行的调用
     * @param requestId 请求ID（可选，不传则取消所有）
     */
    cancel(requestId?: string): Promise<void>;
}

export const externalCall: ExternalCall = {
    call<T = any>(request: ExternalCallRequest): Promise<ExternalCallResponse<T>> {
        if (!registeredExternalCall) {
            throw new Error('External call adapter not registered')
        }
        return registeredExternalCall.call(request)
    },
    isAvailable(type: CallType, target: string): Promise<boolean> {
        if (!registeredExternalCall) {
            throw new Error('External call adapter not registered')
        }
        return registeredExternalCall.isAvailable(type, target)
    },
    getAvailableTargets(type: CallType): Promise<string[]> {
        if (!registeredExternalCall) {
            throw new Error('External call adapter not registered')
        }
        return registeredExternalCall.getAvailableTargets(type)
    },
    cancel(requestId?: string): Promise<void> {
        if (!registeredExternalCall) {
            throw new Error('External call adapter not registered')
        }
        return registeredExternalCall.cancel(requestId)
    }

}
let registeredExternalCall: ExternalCall | null = null
export const registerExternalCall = (externalCall: ExternalCall): void => {
    registeredExternalCall = externalCall
}