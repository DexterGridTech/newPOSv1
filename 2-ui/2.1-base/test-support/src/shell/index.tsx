import React, {useEffect, useMemo, useState} from 'react'
import {Provider} from 'react-redux'
import {
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native'
import type {PlatformPorts} from '@next/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeApp,
    runtimeShellV2CommandDefinitions,
    type KernelRuntimeAppV2,
    type KernelRuntimeModuleV2,
    type KernelRuntimeV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createTopologyRuntimeModuleV3,
    type CreateTopologyRuntimeModuleV3Input,
} from '@next/kernel-base-topology-runtime-v3'
import {tcpControlV2CommandDefinitions} from '@next/kernel-base-tcp-control-runtime-v2'
import {createUiRuntimeModuleV2} from '@next/kernel-base-ui-runtime-v2'
import {type EnhancedStore} from '@reduxjs/toolkit'
import {
    createModule as createRuntimeReactModule,
    UiRuntimeProvider,
    type CreateRuntimeReactModuleInput,
} from '@next/ui-base-runtime-react'
import {
    createBrowserAutomationHost,
    type CreateBrowserAutomationHostOptions,
} from '@next/ui-base-automation-runtime/supports'
import {createBrowserConsoleLogger} from '../logger'

export interface ExpoRuntimeTestHarness {
    app?: KernelRuntimeAppV2
    runtime: KernelRuntimeV2
    store: EnhancedStore
}

export interface ExpoRuntimeReactHarness extends ExpoRuntimeTestHarness {
    app: KernelRuntimeAppV2
}

export interface CreateExpoRuntimeReactHarnessInput {
    runtimeName?: string
    runtimeId?: string
    localNodeId?: string
    modules?: readonly KernelRuntimeModuleV2[]
    platformPorts?: Partial<PlatformPorts>
    displayContext?: {
        displayIndex?: number
        displayCount?: number
    }
    topology?: CreateTopologyRuntimeModuleV3Input
    runtimeReact?: CreateRuntimeReactModuleInput
}

export interface ExpoRuntimeTestShellRenderInput<
    THarness extends ExpoRuntimeTestHarness,
    TContext,
> {
    harness: THarness
    context: TContext
}

export interface ExpoRuntimeTestShellTcpControlInput {
    deviceInfo: {
        id: string
        model: string
    }
}

export interface ExpoRuntimeTestShellProps<
    THarness extends ExpoRuntimeTestHarness,
    TContext = undefined,
> {
    runtimeId: string
    createHarness(): Promise<THarness>
    renderContent(input: ExpoRuntimeTestShellRenderInput<THarness, TContext>): React.ReactNode
    afterInitialize?(harness: THarness): Promise<void> | void
    loadContext?(harness: THarness): Promise<TContext> | TContext
    renderOverlay?(input: ExpoRuntimeTestShellRenderInput<THarness, TContext>): React.ReactNode
    wrapRuntimeChildren?(
        children: React.ReactNode,
        input: ExpoRuntimeTestShellRenderInput<THarness, TContext>,
    ): React.ReactNode
    tcpControl?: ExpoRuntimeTestShellTcpControlInput
    initializeRuntime?: boolean
    automation?: Omit<CreateBrowserAutomationHostOptions, 'runtimeId'>
    loadingTestID?: string
    loadingText?: string
    errorTestID?: string
    style?: StyleProp<ViewStyle>
}

type ExpoRuntimeTestShellState<
    THarness extends ExpoRuntimeTestHarness,
    TContext,
> =
    | {status: 'loading'}
    | {status: 'error'; message: string}
    | {status: 'ready'; harness: THarness; context: TContext}

export const createExpoRuntimeReactHarness = async (
    input: CreateExpoRuntimeReactHarnessInput = {},
): Promise<ExpoRuntimeReactHarness> => {
    const app = createKernelRuntimeApp({
        runtimeName: input.runtimeName ?? 'ui-base-test-support.expo-runtime-react',
        runtimeId: input.runtimeId as any,
        localNodeId: input.localNodeId as any,
        modules: [
            createTopologyRuntimeModuleV3(input.topology),
            createUiRuntimeModuleV2(),
            createRuntimeReactModule(input.runtimeReact),
            ...(input.modules ?? []),
        ],
        platformPorts: {
            environmentMode: 'DEV',
            logger: createBrowserConsoleLogger({
                environmentMode: input.platformPorts?.environmentMode ?? 'DEV',
                scope: {
                    moduleName: 'ui.base.test-support',
                    layer: 'ui',
                    subsystem: 'runtime',
                    component: 'ExpoRuntimeReactHarness',
                },
            }),
            ...input.platformPorts,
        },
        displayContext: {
            displayIndex: input.displayContext?.displayIndex ?? 0,
            displayCount: input.displayContext?.displayCount ?? 1,
        },
    })
    const runtime = await app.start()

    return {
        app,
        runtime,
        store: runtime.getStore(),
    }
}

export const ExpoRuntimeTestShell = <
    THarness extends ExpoRuntimeTestHarness,
    TContext = undefined,
>({
    automation,
    afterInitialize,
    createHarness,
    errorTestID,
    initializeRuntime = true,
    loadContext,
    loadingTestID,
    loadingText = 'Expo test shell loading',
    renderContent,
    renderOverlay,
    runtimeId,
    style,
    tcpControl,
    wrapRuntimeChildren,
}: ExpoRuntimeTestShellProps<THarness, TContext>): React.ReactElement => {
    const [state, setState] = useState<ExpoRuntimeTestShellState<THarness, TContext>>({status: 'loading'})
    const automationHost = useMemo(() => createBrowserAutomationHost({
        autoStart: false,
        buildProfile: 'test',
        target: 'primary',
        ...automation,
        runtimeId,
    }), [automation, runtimeId])

    useEffect(() => {
        if (state.status !== 'ready') {
            return undefined
        }
        automationHost.start()
        return () => {
            automationHost.stop()
        }
    }, [automationHost, state.status])

    useEffect(() => {
        let disposed = false
        void (async () => {
            try {
                const nextHarness = await createHarness()
                if (initializeRuntime) {
                    await nextHarness.runtime.dispatchCommand(createCommand(
                        runtimeShellV2CommandDefinitions.initialize,
                        {},
                    ))
                }
                if (tcpControl) {
                    await nextHarness.runtime.dispatchCommand(createCommand(
                        tcpControlV2CommandDefinitions.bootstrapTcpControl,
                        {
                            deviceInfo: tcpControl.deviceInfo,
                        },
                    ))
                }
                await afterInitialize?.(nextHarness)
                const context = loadContext
                    ? await loadContext(nextHarness)
                    : undefined as TContext
                if (!disposed) {
                    setState({
                        status: 'ready',
                        harness: nextHarness,
                        context,
                    })
                }
            } catch (error) {
                if (!disposed) {
                    setState({
                        status: 'error',
                        message: error instanceof Error ? error.message : String(error),
                    })
                }
            }
        })()
        return () => {
            disposed = true
        }
    }, [])

    if (state.status === 'error') {
        return (
            <View
                testID={errorTestID}
                style={[styles.messageShell, style]}
            >
                <Text style={styles.messageText}>{state.message}</Text>
            </View>
        )
    }

    if (state.status === 'loading') {
        return (
            <View
                testID={loadingTestID}
                style={[styles.messageShell, style]}
            >
                <Text style={styles.messageText}>{loadingText}</Text>
            </View>
        )
    }

    const renderInput: ExpoRuntimeTestShellRenderInput<THarness, TContext> = {
        harness: state.harness,
        context: state.context,
    }
    const runtimeChildren = (
        <>
            {renderContent(renderInput)}
            {renderOverlay?.(renderInput)}
        </>
    )

    return (
        <Provider store={state.harness.store}>
            <UiRuntimeProvider
                runtime={state.harness.runtime}
                automationBridge={automationHost.automationBridge}
                automationRuntimeId={runtimeId}
            >
                {wrapRuntimeChildren
                    ? wrapRuntimeChildren(runtimeChildren, renderInput)
                    : runtimeChildren}
            </UiRuntimeProvider>
        </Provider>
    )
}

const styles = StyleSheet.create({
    messageShell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#eef4fa',
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#0f172a',
        textAlign: 'center',
    },
})
