import {
    selectRuntimeShellV2ParameterCatalog,
    type RuntimeModuleContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import type {WorkflowDefinition, WorkflowStepDefinition} from '../types'
import {workflowRuntimeV2ParameterDefinitions} from '../supports'
import {toParameterNumber} from './engineObservation'

export interface WorkflowEngineConfig {
    getEventHistoryLimit(): number
    getQueueSizeLimit(): number
    getCompletedObservationLimit(): number
    resolveWorkflowTimeoutMs(definition: WorkflowDefinition, timeoutMs?: number): number | undefined
    resolveStepTimeoutMs(step: WorkflowStepDefinition): number | undefined
}

export const createWorkflowEngineConfig = (
    context: RuntimeModuleContextV2,
): WorkflowEngineConfig => {
    /**
     * 设计意图：
     * workflow 的队列、事件保留和超时时间都从 system.parameter catalog 动态读取。
     * 这样 TDP 下发参数后，新启动的 workflow 会立即使用最新策略，不需要重建 engine。
     */
    const getParameterCatalog = () =>
        selectRuntimeShellV2ParameterCatalog(context.getState())

    const getEventHistoryLimit = () =>
        toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.eventHistoryLimit.key,
            workflowRuntimeV2ParameterDefinitions.eventHistoryLimit.defaultValue,
        )

    const getQueueSizeLimit = () =>
        toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.queueSizeLimit.key,
            workflowRuntimeV2ParameterDefinitions.queueSizeLimit.defaultValue,
        )

    const getCompletedObservationLimit = () =>
        toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.completedObservationLimit.key,
            workflowRuntimeV2ParameterDefinitions.completedObservationLimit.defaultValue,
        )

    const resolveWorkflowTimeoutMs = (
        definition: WorkflowDefinition,
        timeoutMs?: number,
    ): number | undefined => {
        if (typeof timeoutMs === 'number' && timeoutMs > 0) {
            return timeoutMs
        }

        const defaultOptionTimeout = definition.defaultOptions?.timeoutMs
        if (typeof defaultOptionTimeout === 'number' && defaultOptionTimeout > 0) {
            return defaultOptionTimeout
        }

        if (typeof definition.timeoutMs === 'number' && definition.timeoutMs > 0) {
            return definition.timeoutMs
        }

        return toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.defaultWorkflowTimeoutMs.key,
            workflowRuntimeV2ParameterDefinitions.defaultWorkflowTimeoutMs.defaultValue,
        )
    }

    const resolveStepTimeoutMs = (step: WorkflowStepDefinition): number | undefined => {
        if (typeof step.timeoutMs === 'number' && step.timeoutMs > 0) {
            return step.timeoutMs
        }

        return toParameterNumber(
            getParameterCatalog(),
            workflowRuntimeV2ParameterDefinitions.defaultStepTimeoutMs.key,
            workflowRuntimeV2ParameterDefinitions.defaultStepTimeoutMs.defaultValue,
        )
    }

    return {
        getEventHistoryLimit,
        getQueueSizeLimit,
        getCompletedObservationLimit,
        resolveWorkflowTimeoutMs,
        resolveStepTimeoutMs,
    }
}
