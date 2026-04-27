import React from 'react'
import {Text, View} from 'react-native'
import {describe, expect, it} from 'vitest'
import {
    defineUiScreenPart,
    ScreenContainer,
    clearUiRendererRegistry,
    useUiRuntimeScreenGatedStoreSubscription,
    useOptionalUiAutomationBridge,
    registerUiRendererParts,
    uiRuntimeRootVariables,
} from '../../src'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {createRuntimeReactHarness, renderWithAutomation} from '../support/runtimeReactHarness'
import {runtimeReactScenarioParts} from '../support/runtimeReactScenarioParts'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('ScreenContainer', () => {
    it('renders an empty screen fallback when no child screen is resolved', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-base-screen-container:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-empty-screen')).resolves.toBeTruthy()
    })

    it('renders a diagnostic fallback when screen entry exists but renderer is missing', async () => {
        const harness = await createRuntimeReactHarness()

        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: [runtimeReactScenarioParts.detail.definition],
            },
        ))
        clearUiRendererRegistry()
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: runtimeReactScenarioParts.detail.definition,
                props: {label: 'missing-renderer'},
                source: 'runtime-react-screen-container.spec',
            },
        ))

        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-base-runtime-react:missing-renderer')).resolves.toBeTruthy()
        await expect(tree.queryNodesByTextContains(runtimeReactScenarioParts.detail.definition.rendererKey)).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains(runtimeReactScenarioParts.detail.definition.partKey)).resolves.not.toHaveLength(0)
    })

    it('shows loading until a new screen commits, then reuses cached screens without loading', async () => {
        const screenEvents: string[] = []
        const renderEvents: string[] = []
        const makePart = (name: string) => defineUiScreenPart<{label: string}>({
            partKey: `ui.base.runtime-react.test.cache.${name}`,
            rendererKey: `ui.base.runtime-react.test.cache.${name}`,
            name: `cache${name}`,
            title: `Cache ${name}`,
            description: `Cache test screen ${name}`,
            containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
            screenModes: ['DESKTOP', 'MOBILE'],
            workspaces: ['main', 'MAIN'],
            instanceModes: ['MASTER', 'SLAVE'],
            component: ({label}) => {
                renderEvents.push(`render:${label}`)
                React.useEffect(() => {
                    screenEvents.push(`mount:${label}`)
                    return () => {
                        screenEvents.push(`unmount:${label}`)
                    }
                }, [label])

                return (
                    <View testID={`ui-base-runtime-react-test:cache:${label}`}>
                        <Text>{label}</Text>
                    </View>
                )
            },
        })
        const first = makePart('first')
        const second = makePart('second')
        registerUiRendererParts([first, second])
        const harness = await createRuntimeReactHarness()
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: [
                    first.definition,
                    second.definition,
                ],
            },
        ))
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-base-screen-container:primary:loading')).resolves.toBeTruthy()
        await tree.act(async () => {
            await flush()
            await flush()
        })
        await expect(tree.queryNodes('ui-base-screen-container:primary:loading')).resolves.toHaveLength(0)
        await expect(tree.getNode('ui-base-runtime-react-test:cache:first')).resolves.toBeTruthy()

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: second.definition,
                props: {label: 'second'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await expect(tree.getNode('ui-base-screen-container:primary:loading')).resolves.toBeTruthy()
        await tree.act(async () => {
            await flush()
            await flush()
        })
        await expect(tree.queryNodes('ui-base-screen-container:primary:loading')).resolves.toHaveLength(0)
        await expect(tree.getNode('ui-base-runtime-react-test:cache:second')).resolves.toBeTruthy()

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await expect(tree.queryNodes('ui-base-screen-container:primary:loading')).resolves.toHaveLength(0)
        await expect(tree.getNode('ui-base-runtime-react-test:cache:first')).resolves.toBeTruthy()
        expect(screenEvents.filter(event => event === 'mount:first')).toHaveLength(1)
        expect(renderEvents.filter(event => event === 'render:first')).toHaveLength(1)
    })

    it('switches back to a cached screen without loading while another screen is still pending', async () => {
        const screenEvents: string[] = []
        const makePart = (name: string) => defineUiScreenPart<{label: string}>({
            partKey: `ui.base.runtime-react.test.pending-cache.${name}`,
            rendererKey: `ui.base.runtime-react.test.pending-cache.${name}`,
            name: `pendingCache${name}`,
            title: `Pending cache ${name}`,
            description: `Pending cache test screen ${name}`,
            containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
            screenModes: ['DESKTOP', 'MOBILE'],
            workspaces: ['main', 'MAIN'],
            instanceModes: ['MASTER', 'SLAVE'],
            component: ({label}) => {
                React.useEffect(() => {
                    screenEvents.push(`mount:${label}`)
                    return () => {
                        screenEvents.push(`unmount:${label}`)
                    }
                }, [label])

                return (
                    <View testID={`ui-base-runtime-react-test:pending-cache:${label}`}>
                        <Text>{label}</Text>
                    </View>
                )
            },
        })
        const first = makePart('first')
        const second = makePart('second')
        registerUiRendererParts([first, second])
        const harness = await createRuntimeReactHarness()
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: [
                    first.definition,
                    second.definition,
                ],
            },
        ))
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )
        await tree.act(async () => {
            await flush()
            await flush()
        })
        await expect(tree.getNode('ui-base-runtime-react-test:pending-cache:first')).resolves.toBeTruthy()

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: second.definition,
                props: {label: 'second'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await expect(tree.getNode('ui-base-screen-container:primary:loading')).resolves.toBeTruthy()

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await expect(tree.queryNodes('ui-base-screen-container:primary:loading')).resolves.toHaveLength(0)
        await expect(tree.getNode('ui-base-runtime-react-test:pending-cache:first')).resolves.toBeTruthy()
        await expect(tree.queryNodes('ui-base-runtime-react-test:pending-cache:second')).resolves.toHaveLength(0)
        expect(screenEvents).not.toContain('mount:second')
    })

    it('destroys least-recently-used cached screens after the parameter limit is exceeded', async () => {
        const screenEvents: string[] = []
        const makePart = (name: string) => defineUiScreenPart<{label: string}>({
            partKey: `ui.base.runtime-react.test.lru.${name}`,
            rendererKey: `ui.base.runtime-react.test.lru.${name}`,
            name: `lru${name}`,
            title: `LRU ${name}`,
            description: `LRU test screen ${name}`,
            containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
            screenModes: ['DESKTOP', 'MOBILE'],
            workspaces: ['main', 'MAIN'],
            instanceModes: ['MASTER', 'SLAVE'],
            component: ({label}) => {
                React.useEffect(() => {
                    screenEvents.push(`mount:${label}`)
                    return () => {
                        screenEvents.push(`unmount:${label}`)
                    }
                }, [label])

                return (
                    <View testID={`ui-base-runtime-react-test:lru:${label}`}>
                        <Text>{label}</Text>
                    </View>
                )
            },
        })
        const first = makePart('first')
        const second = makePart('second')
        registerUiRendererParts([first, second])
        const harness = await createRuntimeReactHarness()
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries,
            {
                entries: [{
                    key: 'kernel.base.ui-runtime-v2.screen-container.cache-size',
                    rawValue: 1,
                    updatedAt: 1 as any,
                    source: 'host',
                }],
            },
        ))
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: [
                    first.definition,
                    second.definition,
                ],
            },
        ))
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )
        await tree.act(async () => {
            await flush()
            await flush()
        })

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: second.definition,
                props: {label: 'second'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await tree.act(async () => {
            await flush()
            await flush()
        })
        expect(screenEvents).toContain('unmount:first')

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await expect(tree.getNode('ui-base-screen-container:primary:loading')).resolves.toBeTruthy()
        await tree.act(async () => {
            await flush()
            await flush()
        })
        expect(screenEvents.filter(event => event === 'mount:first')).toHaveLength(2)
    })

    it('lets a container override the global cache size', async () => {
        const screenEvents: string[] = []
        const makePart = (name: string) => defineUiScreenPart<{label: string}>({
            partKey: `ui.base.runtime-react.test.cache-override.${name}`,
            rendererKey: `ui.base.runtime-react.test.cache-override.${name}`,
            name: `cacheOverride${name}`,
            title: `Cache override ${name}`,
            description: `Cache override test screen ${name}`,
            containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
            screenModes: ['DESKTOP', 'MOBILE'],
            workspaces: ['main', 'MAIN'],
            instanceModes: ['MASTER', 'SLAVE'],
            component: ({label}) => {
                React.useEffect(() => {
                    screenEvents.push(`mount:${label}`)
                    return () => {
                        screenEvents.push(`unmount:${label}`)
                    }
                }, [label])

                return (
                    <View testID={`ui-base-runtime-react-test:cache-override:${label}`}>
                        <Text>{label}</Text>
                    </View>
                )
            },
        })
        const first = makePart('first')
        const second = makePart('second')
        const third = makePart('third')
        registerUiRendererParts([first, second, third])
        const harness = await createRuntimeReactHarness()
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.upsertParameterCatalogEntries,
            {
                entries: [{
                    key: 'kernel.base.ui-runtime-v2.screen-container.cache-size',
                    rawValue: 1,
                    updatedAt: 1 as any,
                    source: 'host',
                }],
            },
        ))
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: [
                    first.definition,
                    second.definition,
                    third.definition,
                ],
            },
        ))
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        const tree = renderWithAutomation(
            <ScreenContainer
                containerPart={uiRuntimeRootVariables.primaryRootContainer}
                cacheSize={3}
            />,
            harness.store,
            harness.runtime,
        )
        await tree.act(async () => {
            await flush()
            await flush()
        })

        for (const part of [second, third, first]) {
            await tree.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.replaceScreen,
                {
                    definition: part.definition,
                    props: {label: part.definition.name.replace('cacheOverride', '').toLowerCase()},
                    source: 'runtime-react-screen-container.spec',
                },
            ))
            await tree.act(async () => {
                await flush()
                await flush()
            })
        }

        await expect(tree.queryNodes('ui-base-screen-container:primary:loading')).resolves.toHaveLength(0)
        expect(screenEvents.filter(event => event === 'mount:first')).toHaveLength(1)
        expect(screenEvents).not.toContain('unmount:first')
    })

    it('keeps automation nodes scoped to the active cached screen without rerendering inactive content', async () => {
        const renderEvents: string[] = []
        const makePart = (name: string) => defineUiScreenPart<{label: string}>({
            partKey: `ui.base.runtime-react.test.active-automation.${name}`,
            rendererKey: `ui.base.runtime-react.test.active-automation.${name}`,
            name: `activeAutomation${name}`,
            title: `Active Automation ${name}`,
            description: `Active automation test screen ${name}`,
            containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
            screenModes: ['DESKTOP', 'MOBILE'],
            workspaces: ['main', 'MAIN'],
            instanceModes: ['MASTER', 'SLAVE'],
            component: ({label}) => {
                const automationBridge = useOptionalUiAutomationBridge()
                renderEvents.push(`render:${label}`)
                React.useEffect(() => {
                    if (!automationBridge) {
                        return undefined
                    }
                    return automationBridge.registerNode({
                        target: 'primary',
                        runtimeId: 'test-runtime',
                        screenKey: label,
                        mountId: `active-automation:${label}`,
                        nodeId: `active-automation:${label}`,
                        testID: `ui-base-runtime-react-test:active-automation:${label}`,
                        semanticId: `active-automation:${label}`,
                        role: 'text',
                        text: label,
                        visible: true,
                        enabled: true,
                        availableActions: [],
                    })
                }, [automationBridge, label])

                return (
                    <View testID={`ui-base-runtime-react-test:active-automation-view:${label}`}>
                        <Text>{label}</Text>
                    </View>
                )
            },
        })
        const first = makePart('first')
        const second = makePart('second')
        registerUiRendererParts([first, second])
        const harness = await createRuntimeReactHarness()
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: [
                    first.definition,
                    second.definition,
                ],
            },
        ))
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )
        await tree.act(async () => {
            await flush()
            await flush()
        })
        await expect(tree.waitForNode('ui-base-runtime-react-test:active-automation:first')).resolves.toBeTruthy()

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: second.definition,
                props: {label: 'second'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await tree.act(async () => {
            await flush()
            await flush()
        })
        await expect(tree.queryNodes('ui-base-runtime-react-test:active-automation:first')).resolves.toHaveLength(0)
        await expect(tree.waitForNode('ui-base-runtime-react-test:active-automation:second')).resolves.toBeTruthy()

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await expect(tree.waitForNode('ui-base-runtime-react-test:active-automation:first')).resolves.toBeTruthy()
        await expect(tree.queryNodes('ui-base-runtime-react-test:active-automation:second')).resolves.toHaveLength(0)
        expect(renderEvents.filter(event => event === 'render:first')).toHaveLength(1)
    })

    it('disconnects inactive cached screen store subscriptions and refreshes them on activation', async () => {
        let storeValue = 'one'
        const storeListeners = new Set<() => void>()
        const subscriptionCounts = new Map<string, number>()
        const renderEvents: string[] = []
        const notifyStoreListeners = () => {
            for (const listener of [...storeListeners]) {
                listener()
            }
        }
        const makePart = (name: string) => defineUiScreenPart<{label: string}>({
            partKey: `ui.base.runtime-react.test.gated-store.${name}`,
            rendererKey: `ui.base.runtime-react.test.gated-store.${name}`,
            name: `gatedStore${name}`,
            title: `Gated Store ${name}`,
            description: `Gated store subscription test screen ${name}`,
            containerKey: uiRuntimeRootVariables.primaryRootContainer.key,
            screenModes: ['DESKTOP', 'MOBILE'],
            workspaces: ['main', 'MAIN'],
            instanceModes: ['MASTER', 'SLAVE'],
            component: ({label}) => {
                const subscribe = React.useCallback((listener: () => void) => {
                    storeListeners.add(listener)
                    subscriptionCounts.set(label, (subscriptionCounts.get(label) ?? 0) + 1)
                    return () => {
                        storeListeners.delete(listener)
                        const nextCount = (subscriptionCounts.get(label) ?? 1) - 1
                        if (nextCount > 0) {
                            subscriptionCounts.set(label, nextCount)
                        } else {
                            subscriptionCounts.delete(label)
                        }
                    }
                }, [label])
                const getSnapshot = React.useCallback(() => storeValue, [])
                const value = useUiRuntimeScreenGatedStoreSubscription(subscribe, getSnapshot)
                renderEvents.push(`render:${label}:${value}`)

                return (
                    <View testID={`ui-base-runtime-react-test:gated-store:${label}`}>
                        <Text>{`${label}:${value}`}</Text>
                    </View>
                )
            },
        })
        const first = makePart('first')
        const second = makePart('second')
        registerUiRendererParts([first, second])
        const harness = await createRuntimeReactHarness()
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.registerScreenDefinitions,
            {
                definitions: [
                    first.definition,
                    second.definition,
                ],
            },
        ))
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        const tree = renderWithAutomation(
            <ScreenContainer containerPart={uiRuntimeRootVariables.primaryRootContainer} />,
            harness.store,
            harness.runtime,
        )
        await tree.act(async () => {
            await flush()
            await flush()
        })
        expect(subscriptionCounts.get('first')).toBe(1)
        await expect(tree.getText('ui-base-runtime-react-test:gated-store:first')).resolves.toBe('first:one')

        await tree.act(async () => {
            storeValue = 'two'
            notifyStoreListeners()
        })
        await expect(tree.getText('ui-base-runtime-react-test:gated-store:first')).resolves.toBe('first:two')

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: second.definition,
                props: {label: 'second'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await tree.act(async () => {
            await flush()
            await flush()
        })
        expect(subscriptionCounts.get('first')).toBeUndefined()
        expect(subscriptionCounts.get('second')).toBe(1)

        await tree.act(async () => {
            storeValue = 'three'
            notifyStoreListeners()
        })
        expect(renderEvents).not.toContain('render:first:three')
        await expect(tree.getText('ui-base-runtime-react-test:gated-store:second')).resolves.toBe('second:three')

        await tree.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.replaceScreen,
            {
                definition: first.definition,
                props: {label: 'first'},
                source: 'runtime-react-screen-container.spec',
            },
        ))
        await expect(tree.queryNodes('ui-base-screen-container:primary:loading')).resolves.toHaveLength(0)
        await expect(tree.getText('ui-base-runtime-react-test:gated-store:first')).resolves.toBe('first:three')
        expect(subscriptionCounts.get('first')).toBe(1)
        expect(subscriptionCounts.get('second')).toBeUndefined()
    })
})
