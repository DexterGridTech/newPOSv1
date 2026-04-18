import React, {useEffect, useMemo, useState} from 'react'
import {Provider} from 'react-redux'
import {ScrollView, Text, View} from 'react-native'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import type {CommandAggregateResult} from '@impos2/kernel-base-runtime-shell-v2'
import {topologyRuntimeV2CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v2'
import {createRuntimeReactHarness} from '../test/support/runtimeReactHarness'
import {createRuntimeReactScenarioModule} from '../test/support/runtimeReactScenarioModule'
import {RuntimeReactScenarioStatePanel} from '../test/support/RuntimeReactScenarioStatePanel'
import {UiRuntimeProvider, UiRuntimeRootShell} from '../src'
import type {RuntimeReactHarness} from '../test/support/runtimeReactHarness'
import {createBrowserAutomationHost} from '../../ui-automation-runtime/src/supports'
import {getRuntimeReactExpoConfig} from './runtimeReactExpoConfig'
import {createTopologyHostAssembly} from './topologyHostAssembly'

const sectionStyle = {
    gap: 8,
    padding: 16,
    borderRadius: 16 as const,
    backgroundColor: '#ffffff',
}

interface RuntimeExpoErrorBoundaryState {
    error: Error | null
}

class RuntimeExpoErrorBoundary extends React.Component<
    {
        title: string
        children: React.ReactNode
    },
    RuntimeExpoErrorBoundaryState
> {
    state: RuntimeExpoErrorBoundaryState = {
        error: null,
    }

    static getDerivedStateFromError(error: Error): RuntimeExpoErrorBoundaryState {
        return {error}
    }

    override render() {
        if (!this.state.error) {
            return this.props.children
        }

        return (
            <View style={sectionStyle}>
                <Text selectable style={{fontSize: 18, fontWeight: '700'}}>
                    {this.props.title} Failed
                </Text>
                <Text selectable testID="ui-base-runtime-react-test:expo-error-message">
                    {this.state.error.message}
                </Text>
                <Text selectable testID="ui-base-runtime-react-test:expo-error-stack">
                    {this.state.error.stack ?? 'no-stack'}
                </Text>
            </View>
        )
    }
}

export const RuntimeReactExpoShell: React.FC = () => {
    const config = getRuntimeReactExpoConfig()
    const [harness, setHarness] = useState<RuntimeReactHarness | null>(null)
    const [bootError, setBootError] = useState<string | null>(null)
    const [topologyStartError, setTopologyStartError] = useState<string | null>(null)
    const [topologyStartResult, setTopologyStartResult] = useState<CommandAggregateResult | null>(null)
    const automationHost = useMemo(() => createBrowserAutomationHost({
        autoStart: false,
        buildProfile: 'test',
        runtimeId: 'runtime-react-expo',
        target: config.displayIndex > 0 ? 'secondary' : 'primary',
        getRuntimeState: () => harness?.runtime.getState() ?? null,
    }), [config.displayIndex, harness])

    useEffect(() => {
        if (!harness) {
            return undefined
        }
        automationHost.start()
        return () => {
            automationHost.stop()
        }
    }, [automationHost, harness])

    useEffect(() => {
        let disposed = false

        void (async () => {
            try {
                const nextHarness = await createRuntimeReactHarness({
                    modules: [createRuntimeReactScenarioModule()],
                    localNodeId: config.topologyNodeId,
                    displayContext: {
                        displayIndex: config.displayIndex,
                        displayCount: config.displayCount,
                    },
                    platformPorts: {
                        environmentMode: 'DEV',
                    },
                    topology: createTopologyHostAssembly(config),
                })

                if (disposed) {
                    return
                }
                if (config.topologyMode === 'host') {
                    try {
                        if (config.topologyRole === 'master') {
                            await nextHarness.runtime.dispatchCommand(createCommand(
                                topologyRuntimeV2CommandDefinitions.setEnableSlave,
                                {
                                    enableSlave: true,
                                },
                            ))
                        } else if (config.topologyHostBaseUrl) {
                            await nextHarness.runtime.dispatchCommand(createCommand(
                                topologyRuntimeV2CommandDefinitions.setMasterInfo,
                                {
                                    masterInfo: {
                                        deviceId: config.deviceId,
                                        serverAddress: [
                                            {
                                                address: config.topologyHostBaseUrl,
                                            },
                                        ],
                                        addedAt: Date.now(),
                                    },
                                },
                            ))
                        }
                        const result = await nextHarness.runtime.dispatchCommand(createCommand(
                            topologyRuntimeV2CommandDefinitions.startTopologyConnection,
                            {},
                        ))
                        if (!disposed) {
                            setTopologyStartResult(result)
                        }
                    } catch (error) {
                        if (!disposed) {
                            setTopologyStartError(error instanceof Error ? error.message : String(error))
                        }
                    }
                }
                setHarness(nextHarness)
            } catch (error) {
                if (disposed) {
                    return
                }
                setBootError(error instanceof Error ? error.message : String(error))
            }
        })()

        return () => {
            disposed = true
        }
    }, [
        config.deviceId,
        config.displayCount,
        config.displayIndex,
        config.topologyHostBaseUrl,
        config.topologyMode,
        config.topologyProfileName,
        config.topologyRole,
        config.topologyTicketToken,
        config.topologyWsUrl,
    ])

    const topologySummary = config.topologyMode === 'host'
        ? 'real-dual-topology-host'
        : config.enableDualTopologyPreview
            ? 'dual-root-preview-no-host'
            : 'single-runtime'

    if (bootError) {
        return (
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{
                    padding: 20,
                    gap: 16,
                }}
            >
                <View style={sectionStyle}>
                    <Text selectable style={{fontSize: 20, fontWeight: '700'}}>
                        Runtime React Expo Boot Failed
                    </Text>
                    <Text selectable>{bootError}</Text>
                </View>
            </ScrollView>
        )
    }

    if (!harness) {
        return (
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{
                    padding: 20,
                    gap: 16,
                }}
            >
                <View style={sectionStyle}>
                    <Text selectable style={{fontSize: 20, fontWeight: '700'}}>
                        Runtime React Expo Loading
                    </Text>
                    <Text selectable>Bootstrapping kernel runtime...</Text>
                </View>
            </ScrollView>
        )
    }

    return (
        <Provider store={harness.store}>
            <UiRuntimeProvider runtime={harness.runtime}>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    contentContainerStyle={{
                        padding: 20,
                        gap: 16,
                        backgroundColor: '#f4f7fb',
                    }}
                >
                    <View style={sectionStyle}>
                        <Text selectable style={{fontSize: 24, fontWeight: '700'}}>
                            Runtime React Test Expo
                        </Text>
                        <Text selectable>
                            This page validates runtime-react with the real kernel runtime and test-only screen parts.
                        </Text>
                        <Text selectable>
                            displayIndex={config.displayIndex}, displayCount={config.displayCount}, deviceId={config.deviceId}
                        </Text>
                        <Text selectable>
                            topologyMode={topologySummary}, topologyRole={config.topologyRole}
                        </Text>
                        {config.topologyMode === 'host' ? (
                            <Text selectable>
                                hostBaseUrl={config.topologyHostBaseUrl}, wsUrl={config.topologyWsUrl}
                            </Text>
                        ) : null}
                    </View>

                    {topologyStartError ? (
                        <View style={sectionStyle}>
                            <Text selectable style={{fontSize: 18, fontWeight: '700'}}>
                                Topology Start Error
                            </Text>
                            <Text selectable testID="ui-base-runtime-react-test:topology-start-error">
                                {topologyStartError}
                            </Text>
                        </View>
                    ) : null}

                    {topologyStartResult ? (
                        <View style={sectionStyle}>
                            <Text selectable style={{fontSize: 18, fontWeight: '700'}}>
                                Topology Start Result
                            </Text>
                            <Text selectable testID="ui-base-runtime-react-test:topology-start-status">
                                {topologyStartResult.status}
                            </Text>
                            <Text selectable testID="ui-base-runtime-react-test:topology-start-actor-count">
                                {String(topologyStartResult.actorResults.length)}
                            </Text>
                        </View>
                    ) : null}

                    <View style={sectionStyle}>
                        <Text selectable style={{fontSize: 18, fontWeight: '700'}}>
                            State Panel
                        </Text>
                        <RuntimeReactScenarioStatePanel />
                    </View>

                    <View style={sectionStyle}>
                        <Text selectable style={{fontSize: 18, fontWeight: '700'}}>
                            Primary Root
                        </Text>
                        <RuntimeExpoErrorBoundary title="Primary Root">
                            <UiRuntimeRootShell />
                        </RuntimeExpoErrorBoundary>
                    </View>

                    {config.displayCount > 1 ? (
                        <View style={sectionStyle}>
                            <Text selectable style={{fontSize: 18, fontWeight: '700'}}>
                                Secondary Root Preview
                            </Text>
                            <RuntimeExpoErrorBoundary title="Secondary Root Preview">
                                <UiRuntimeRootShell display="secondary" />
                            </RuntimeExpoErrorBoundary>
                        </View>
                    ) : null}
                </ScrollView>
            </UiRuntimeProvider>
        </Provider>
    )
}
