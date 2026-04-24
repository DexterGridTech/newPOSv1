import React from 'react'
import TestRenderer from 'react-test-renderer'
import {Provider} from 'react-redux'
import {createAutomationJsonRpcClient} from '@impos2/ui-base-automation-runtime'
import {UiRuntimeProvider} from '@impos2/ui-base-runtime-react'

export interface RuntimeLike {
    readonly runtimeId?: string
    getStore(): unknown
    dispatchCommand?(command: unknown): Promise<unknown>
}

interface RuntimeAppLike<TRuntime extends RuntimeLike> {
    start(): Promise<TRuntime>
    readonly automation?: {
        readonly controller: {
            dispatchMessage(messageJson: string): Promise<string>
        }
        dispose(): void
    }
    readonly uiRuntimeProviderProps?: Record<string, unknown>
}

export interface MountedAssemblyAutomationApp {
    readonly runtime: RuntimeLike
    readonly client: ReturnType<typeof createAutomationJsonRpcClient>
    act(run: () => void | Promise<void>): Promise<void>
    dispatch(run: () => void | Promise<void>): Promise<void>
    dispatchCommand(command: unknown): Promise<unknown>
    press(nodeId: string, action?: string): Promise<unknown>
    typeVirtualValue(fieldNodeId: string, value: string, options?: {clear?: boolean}): Promise<void>
    unmount(): Promise<void>
}

export const mountAssemblyAutomationApp = async (
    runtimeApp: RuntimeAppLike<RuntimeLike>,
    element: React.ReactElement,
): Promise<MountedAssemblyAutomationApp> => {
    const runtime = await runtimeApp.start()
    const client = createAutomationJsonRpcClient(runtimeApp.automation!.controller)
    const target = (runtime as any).displayContext?.displayIndex > 0 ? 'secondary' : 'primary'

    let tree!: TestRenderer.ReactTestRenderer
    await TestRenderer.act(async () => {
        tree = TestRenderer.create(
                <Provider store={runtime.getStore() as any}>
                    <UiRuntimeProvider runtime={runtime as any} {...(runtimeApp.uiRuntimeProviderProps ?? {})}>
                        {element as any}
                    </UiRuntimeProvider>
                </Provider>,
            )
        })

    return {
        runtime,
        client,
        async act(run) {
            await TestRenderer.act(async () => {
                await run()
            })
        },
        async dispatch(run) {
            await TestRenderer.act(async () => {
                await run()
            })
        },
        async dispatchCommand(command) {
            let result: unknown
            await TestRenderer.act(async () => {
                result = await runtime.dispatchCommand?.(command)
            })
            return result
        },
        async press(nodeId, action = 'press') {
            let result: unknown
            await TestRenderer.act(async () => {
                await client.call('wait.forNode', {
                    target,
                    nodeId,
                    timeoutMs: 3_000,
                })
                result = await client.call('ui.performAction', {
                    target,
                    nodeId,
                    action,
                })
            })
            return result
        },
        async typeVirtualValue(fieldNodeId, value, options = {}) {
            await TestRenderer.act(async () => {
                await client.call('ui.performAction', {
                    target,
                    nodeId: fieldNodeId,
                    action: 'press',
                })
            })
            await client.call('wait.forNode', {
                target,
                testID: 'ui-base-virtual-keyboard',
                timeoutMs: 3_000,
            })
            if (options.clear !== false) {
                await TestRenderer.act(async () => {
                    await client.call('wait.forNode', {
                        target,
                        nodeId: 'ui-base-virtual-keyboard:key:clear',
                        timeoutMs: 3_000,
                    })
                    await client.call('ui.performAction', {
                        target,
                        nodeId: 'ui-base-virtual-keyboard:key:clear',
                        action: 'press',
                    })
                })
            }
            for (const key of value.toUpperCase().split('')) {
                await TestRenderer.act(async () => {
                    await client.call('wait.forNode', {
                        target,
                        nodeId: `ui-base-virtual-keyboard:key:${key}`,
                        timeoutMs: 3_000,
                    })
                    await client.call('ui.performAction', {
                        target,
                        nodeId: `ui-base-virtual-keyboard:key:${key}`,
                        action: 'press',
                    })
                })
            }
            await TestRenderer.act(async () => {
                await client.call('wait.forNode', {
                    target,
                    nodeId: 'ui-base-virtual-keyboard:key:enter',
                    timeoutMs: 3_000,
                })
                await client.call('ui.performAction', {
                    target,
                    nodeId: 'ui-base-virtual-keyboard:key:enter',
                    action: 'press',
                })
            })
        },
        async unmount() {
            await TestRenderer.act(async () => {
                tree.unmount()
            })
            runtimeApp.automation?.dispose()
        },
    }
}
