import React, {useEffect, useState} from 'react'
import {Provider} from 'react-redux'
import {View, Text} from 'react-native'
import {UiRuntimeProvider} from '@impos2/ui-base-runtime-react'
import type {UiRuntimeProviderProps} from '@impos2/ui-base-runtime-react'
import {RootScreen} from '@impos2/ui-integration-retail-shell'
import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {
    createApp,
    getAssemblyAutomationHostConfig,
    reportAppLoadComplete,
    reportTerminalVersion,
    resolveAssemblyTopologyLaunch,
} from './src/application'
import {nativeAutomationHost, nativeLogger} from './src/turbomodules'
import type {AppProps} from './src/types'

interface AssemblyReadyState {
    runtime: KernelRuntimeV2
    store: EnhancedStore
    uiRuntimeProviderProps?: Pick<
        UiRuntimeProviderProps,
        'automationBridge' | 'automationRuntimeId' | 'performAutomationAction'
    >
}

const normalizeProps = (props: Partial<AppProps>): AppProps => ({
    deviceId: props.deviceId ?? 'UNKNOWN-ANDROID-DEVICE',
    screenMode: props.screenMode ?? 'desktop',
    displayCount: props.displayCount ?? 1,
    displayIndex: props.displayIndex ?? 0,
    isEmulator: props.isEmulator ?? false,
    topology: props.topology,
})

export default function App(rawProps: Partial<AppProps>): React.JSX.Element {
    const props = normalizeProps(rawProps)
    const [ready, setReady] = useState<AssemblyReadyState | null>(null)
    const [bootError, setBootError] = useState<string>('')
    const [bootStage, setBootStage] = useState<string>('rendered')
    const [loadCompleteReported, setLoadCompleteReported] = useState(false)
    const automationHostConfig = getAssemblyAutomationHostConfig(props.displayIndex)

    useEffect(() => {
        let disposed = false
        let unsubscribeAutomationMessages: (() => void) | undefined
        let automationHostStarted = false
        void (async () => {
            try {
                const logStage = (stage: string, extra?: Record<string, unknown>) => {
                    nativeLogger.log(
                        'assembly.android.mixc-retail-rn84.boot',
                        JSON.stringify({
                            stage,
                            displayIndex: props.displayIndex,
                            displayCount: props.displayCount,
                            topologyRole: props.topology?.role,
                            topologyWsUrl: props.topology?.wsUrl,
                            ...extra,
                        }),
                    )
                    if (!disposed) {
                        setBootStage(stage)
                    }
                }

                logStage('resolve-topology:start')
                const topology = await resolveAssemblyTopologyLaunch(props)
                logStage('resolve-topology:done', {
                    resolvedRole: topology?.role,
                    resolvedWsUrl: topology?.wsUrl,
                })
                const resolvedProps: AppProps = {
                    ...props,
                    topology,
                }
                logStage('create-app:start')
                const runtimeApp = createApp(resolvedProps)
                logStage('create-app:done')
                logStage('runtime.start:start')
                const runtime = await runtimeApp.start()
                logStage('runtime.start:done')

                if (runtimeApp.automation) {
                    const automationHostAddress = await nativeAutomationHost.start({
                        port: automationHostConfig.port,
                    })
                    automationHostStarted = true
                    logStage('automation.host:start', {
                        target: automationHostConfig.target,
                        host: automationHostAddress.host,
                        port: automationHostAddress.port,
                    })
                    unsubscribeAutomationMessages = nativeAutomationHost.subscribeMessages(async event => {
                        try {
                            const response = await runtimeApp.automation!.controller.dispatchMessage(event.messageJson)
                            await nativeAutomationHost.resolveMessage(event.callId, response)
                        } catch (error) {
                            await nativeAutomationHost.rejectMessage(
                                event.callId,
                                error instanceof Error ? error.message : String(error),
                            )
                        }
                    })
                }

                if (!disposed) {
                    setReady({
                        runtime,
                        store: runtime.getStore(),
                        uiRuntimeProviderProps: runtimeApp.uiRuntimeProviderProps,
                    })
                }
            } catch (error) {
                if (!disposed) {
                    nativeLogger.error(
                        'assembly.android.mixc-retail-rn84.boot',
                        error instanceof Error ? error.stack ?? error.message : String(error),
                    )
                    setBootError(error instanceof Error ? error.message : String(error))
                }
            }
        })()
        return () => {
            disposed = true
            unsubscribeAutomationMessages?.()
            if (automationHostStarted) {
                void nativeAutomationHost.stop().catch(() => {})
            }
        }
    }, [automationHostConfig.port, automationHostConfig.target, props.deviceId, props.displayCount, props.displayIndex, props.isEmulator, props.screenMode, props.topology])

    useEffect(() => {
        if (!ready || loadCompleteReported) {
            return
        }

        let cancelled = false

        void (async () => {
            try {
                const result = await reportAppLoadComplete(ready.runtime, props.displayIndex)
                await reportTerminalVersion(
                    ready.runtime,
                    props,
                    result.terminalState,
                    result.reason,
                )
                if (!cancelled) {
                    setLoadCompleteReported(true)
                }
            } catch (error) {
                nativeLogger.error(
                    'assembly.android.mixc-retail-rn84.boot',
                    error instanceof Error ? error.stack ?? error.message : String(error),
                )
            }
        })()

        return () => {
            cancelled = true
        }
    }, [loadCompleteReported, props.displayIndex, ready])

    if (bootError) {
        return (
            <View testID="assembly.android.mixc-retail-rn84:boot-error" style={{flex: 1, padding: 24}}>
                <Text selectable>{bootError}</Text>
            </View>
        )
    }

    if (!ready) {
        return (
            <View testID="assembly.android.mixc-retail-rn84:booting" style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
                <Text>Mixc Retail Assembly Starting...</Text>
                <Text>{bootStage}</Text>
            </View>
        )
    }

    return (
        <Provider store={ready.store}>
            <UiRuntimeProvider
                runtime={ready.runtime}
                {...(ready.uiRuntimeProviderProps ?? {})}
            >
                <RootScreen deviceId={props.deviceId} />
            </UiRuntimeProvider>
        </Provider>
    )
}
