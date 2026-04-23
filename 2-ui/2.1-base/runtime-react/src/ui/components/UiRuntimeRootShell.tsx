import React, {useEffect} from 'react'
import {View} from 'react-native'
import {createCommand, defineCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeRootVariables} from '../../foundations/uiVariables'
import type {RuntimeReactAutomationBridge} from '../../types'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
} from '../../contexts/UiRuntimeContext'
import {useUiRuntime} from '../../contexts/UiRuntimeContext'
import {AlertHost} from './AlertHost'
import {OverlayHost} from './OverlayHost'
import {ScreenContainer} from './ScreenContainer'

const recordUserOperationCommand = defineCommand<{at?: number}>({
    moduleName: 'kernel.base.tdp-sync-runtime-v2',
    commandName: 'record-user-operation',
    allowNoActor: true,
})

export interface UiRuntimeRootShellProps {
    display?: 'primary' | 'secondary'
    children?: React.ReactNode
    automationBridge?: RuntimeReactAutomationBridge
    automationRuntimeId?: string
}

export const UiRuntimeRootShell: React.FC<UiRuntimeRootShellProps> = ({
    display = 'primary',
    children,
    automationBridge: automationBridgeProp,
    automationRuntimeId: automationRuntimeIdProp,
}) => {
    const runtime = useUiRuntime()
    const automationBridge = automationBridgeProp ?? useOptionalUiAutomationBridge() ?? undefined
    const automationRuntimeId = automationRuntimeIdProp
        ?? useOptionalUiAutomationRuntimeId()
        ?? `${display}-runtime`
    const container = display === 'secondary'
        ? uiRuntimeRootVariables.secondaryRootContainer
        : uiRuntimeRootVariables.primaryRootContainer

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        const target = display
        return automationBridge.registerNode({
            target,
            runtimeId: automationRuntimeId,
            screenKey: 'runtime-root',
            mountId: `root:${target}`,
            nodeId: `root:${target}`,
            testID: `ui-base-root-shell:${target}`,
            semanticId: `runtime-root:${target}`,
            role: 'root',
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: [],
        })
    }, [automationBridge, automationRuntimeId, display])

    const recordUserOperation = () => {
        void runtime.dispatchCommand(createCommand(recordUserOperationCommand, {
            at: Date.now(),
        }))
    }

    return (
        <View
            testID={`ui-base-root-shell:${display}`}
            style={{flex: 1}}
            onTouchStart={recordUserOperation}
        >
            {children}
            <ScreenContainer
                automationBridge={automationBridge}
                automationRuntimeId={automationRuntimeId}
                automationTarget={display}
                containerPart={container}
            />
            <OverlayHost
                automationBridge={automationBridge}
                automationRuntimeId={automationRuntimeId}
                automationTarget={display}
                displayMode={display === 'secondary' ? 'SECONDARY' : 'PRIMARY'}
            />
            <AlertHost
                automationBridge={automationBridge}
                automationRuntimeId={automationRuntimeId}
                automationTarget={display}
                displayMode={display === 'secondary' ? 'SECONDARY' : 'PRIMARY'}
            />
        </View>
    )
}
