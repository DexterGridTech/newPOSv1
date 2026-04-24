import React, {useEffect, useMemo, useState} from 'react'
import {View} from 'react-native'
import {useSelector} from 'react-redux'
import {selectTopologyDisplayMode, selectTopologyStandalone} from '@impos2/kernel-base-topology-runtime-v3'
import {
    InputRuntimeProvider,
    VirtualKeyboardOverlay,
} from '@impos2/ui-base-input-runtime'
import {
    AdminPopup,
    useAdminLauncher,
} from '@impos2/ui-base-admin-console'
import {UiRuntimeRootShell} from '@impos2/ui-base-runtime-react'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useUiRuntime,
} from '@impos2/ui-base-runtime-react'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import type {CateringRootScreenProps} from '../../types'

export const RootScreen: React.FC<CateringRootScreenProps> = ({
    deviceId = 'UNKNOWN-DEVICE',
}) => {
    const runtime = useUiRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId()
        ?? ((runtime.displayContext.displayIndex ?? 0) > 0 ? 'secondary-runtime' : 'primary-runtime')
    const displayMode = useSelector((state: RootState) => selectTopologyDisplayMode(state) ?? 'PRIMARY')
    const standalone = useSelector((state: RootState) => selectTopologyStandalone(state) ?? true)
    const [showAdminPopup, setShowAdminPopup] = useState(false)

    const launcherHandlers = useAdminLauncher({
        enabled: standalone,
        onTriggered: () => {
            setShowAdminPopup(true)
        },
    })

    const display = useMemo<'primary' | 'secondary'>(() => {
        /**
         * 设计意图：
         * 主副屏宿主身份由 assembly/runtime 的 displayIndex 决定，这是启动时就稳定的事实。
         * topology displayMode 仍然作为业务可观测状态保留，但不再承担 RootScreen 首次选容器的职责，
         * 否则副屏会受到 initialize 时序影响，短暂落到 primary root。
         */
        if ((runtime.displayContext.displayIndex ?? 0) > 0) {
            return 'secondary'
        }
        return displayMode === 'SECONDARY' ? 'secondary' : 'primary'
    }, [displayMode, runtime.displayContext.displayIndex])

    useEffect(() => {
        if (!automationBridge) {
            return undefined
        }
        const rootId = 'ui-integration-catering-shell:root'
        const displayRootId = `ui-integration-catering-shell:root:${display}`
        const launcherId = 'ui-integration-catering-shell:admin-launcher'
        const unregisterRoot = automationBridge.registerNode({
            target: display,
            runtimeId: automationRuntimeId,
            screenKey: 'catering-shell-root',
            mountId: `${rootId}:${display}`,
            nodeId: displayRootId,
            testID: displayRootId,
            semanticId: displayRootId,
            role: 'root',
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: [],
        })
        const unregisterLauncher = automationBridge.registerNode({
            target: display,
            runtimeId: automationRuntimeId,
            screenKey: 'catering-shell-root',
            mountId: `${launcherId}:${display}`,
            nodeId: launcherId,
            testID: launcherId,
            semanticId: launcherId,
            role: 'button',
            text: '管理员入口',
            visible: true,
            enabled: standalone,
            persistent: true,
            availableActions: standalone ? ['press'] : [],
            onAutomationAction: action => {
                if (action.action !== 'press' || !standalone) {
                    return {ok: false}
                }
                setShowAdminPopup(true)
                return {ok: true}
            },
        })
        return () => {
            unregisterLauncher()
            unregisterRoot()
        }
    }, [automationBridge, automationRuntimeId, display, standalone])

    return (
        <InputRuntimeProvider>
            <View
                testID="ui-integration-catering-shell:root"
                style={{flex: 1}}
                {...launcherHandlers}
            >
                <View
                    testID={`ui-integration-catering-shell:root:${display}`}
                    style={{flex: 1}}
                >
                    <UiRuntimeRootShell display={display} />
                </View>
                {showAdminPopup ? (
                    <AdminPopup
                        deviceId={deviceId}
                        onClose={() => setShowAdminPopup(false)}
                    />
                ) : null}
                <VirtualKeyboardOverlay />
            </View>
        </InputRuntimeProvider>
    )
}
