import {createAppError} from '@next/kernel-base-contracts'
import type {PlatformPorts} from '@next/kernel-base-platform-ports'
import {workflowRuntimeV2ErrorDefinitions} from '../supports'

export const executeExternalCall = async (input: {
    platformPorts: PlatformPorts
    stepKey: string
    payload: {
        channel?: Record<string, unknown>
        action?: string
        params?: Record<string, unknown>
        timeoutMs?: number
    } | undefined
}): Promise<unknown> => {
    const connector = input.platformPorts.connector
    if (!connector?.call) {
        throw createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
            args: {stepKey: input.stepKey},
            details: {reason: 'connector.call unavailable'},
        })
    }

    const action = input.payload?.action
    const channel = input.payload?.channel
    if (!action || !channel) {
        throw createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
            args: {stepKey: input.stepKey},
            details: {reason: 'missing external-call action or channel'},
        })
    }

    return await connector.call({
        channel,
        action,
        params: input.payload?.params,
        timeoutMs: input.payload?.timeoutMs,
    })
}

export const executeExternalSubscribe = async (input: {
    platformPorts: PlatformPorts
    stepKey: string
    payload: {
        channel?: Record<string, unknown>
        timeoutMs?: number
    } | undefined
}): Promise<unknown> => {
    const connector = input.platformPorts.connector
    if (!connector?.subscribe || !connector.unsubscribe) {
        throw createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
            args: {stepKey: input.stepKey},
            details: {reason: 'connector subscribe unavailable'},
        })
    }

    const channel = input.payload?.channel
    if (!channel) {
        throw createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
            args: {stepKey: input.stepKey},
            details: {reason: 'missing external-subscribe channel'},
        })
    }

    const subscribe = connector.subscribe
    const unsubscribe = connector.unsubscribe

    return await new Promise<unknown>((resolve, reject) => {
        let settled = false
        let subscriptionId: string | undefined
        const timeout = input.payload?.timeoutMs
        const timer = typeof timeout === 'number' && timeout > 0
            ? setTimeout(() => {
                if (settled) {
                    return
                }
                settled = true
                if (subscriptionId) {
                    void unsubscribe(subscriptionId)
                }
                reject(createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
                    args: {stepKey: input.stepKey},
                    details: {reason: 'external-subscribe timeout'},
                }))
            }, timeout)
            : undefined

        void subscribe({
            channel,
            onMessage(message) {
                if (settled) {
                    return
                }
                settled = true
                if (timer) {
                    clearTimeout(timer)
                }
                if (subscriptionId) {
                    void unsubscribe(subscriptionId)
                }
                resolve(message)
            },
            onError(error) {
                if (settled) {
                    return
                }
                settled = true
                if (timer) {
                    clearTimeout(timer)
                }
                if (subscriptionId) {
                    void unsubscribe(subscriptionId)
                }
                reject(createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
                    args: {stepKey: input.stepKey},
                    details: error,
                }))
            },
        }).then(id => {
            subscriptionId = id
        }).catch(error => {
            if (settled) {
                return
            }
            settled = true
            if (timer) {
                clearTimeout(timer)
            }
            reject(createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
                args: {stepKey: input.stepKey},
                cause: error,
            }))
        })
    })
}

export const executeExternalOn = async (input: {
    platformPorts: PlatformPorts
    stepKey: string
    payload: {
        eventType?: string
        timeoutMs?: number
        target?: string
    } | undefined
}): Promise<unknown> => {
    const connector = input.platformPorts.connector
    if (!connector?.on) {
        throw createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
            args: {stepKey: input.stepKey},
            details: {reason: 'connector.on unavailable'},
        })
    }

    const eventType = input.payload?.eventType
    if (!eventType) {
        throw createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
            args: {stepKey: input.stepKey},
            details: {reason: 'missing external-on eventType'},
        })
    }

    return await new Promise<unknown>((resolve, reject) => {
        let settled = false
        let timer: ReturnType<typeof setTimeout> | undefined
        const off = connector.on?.(eventType, event => {
            if (settled) {
                return
            }
            if (input.payload?.target && event.target !== input.payload.target) {
                return
            }
            settled = true
            if (timer) {
                clearTimeout(timer)
            }
            off?.()
            resolve(event)
        })

        const timeout = input.payload?.timeoutMs
        timer = typeof timeout === 'number' && timeout > 0
            ? setTimeout(() => {
                if (settled) {
                    return
                }
                settled = true
                off?.()
                reject(createAppError(workflowRuntimeV2ErrorDefinitions.workflowStepFailed, {
                    args: {stepKey: input.stepKey},
                    details: {reason: 'external-on timeout'},
                }))
            }, timeout)
            : undefined
    })
}
