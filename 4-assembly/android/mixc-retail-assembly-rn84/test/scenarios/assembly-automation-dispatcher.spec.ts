import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    defineCommandMock,
    createCommandMock,
    nativeScriptExecuteMock,
    selectUiScreenMock,
    selectUiOverlaysMock,
} = vi.hoisted(() => ({
    defineCommandMock: vi.fn((input: Record<string, unknown>) => input),
    createCommandMock: vi.fn((definition: unknown, payload: unknown) => ({
        definition,
        payload,
    })),
    nativeScriptExecuteMock: vi.fn(),
    selectUiScreenMock: vi.fn(() => ({
        id: 'screen-home',
        partKey: 'home',
        rendererKey: 'home-renderer',
        props: null,
    })),
    selectUiOverlaysMock: vi.fn(() => []),
}))

vi.mock('@impos2/kernel-base-runtime-shell-v2', async importOriginal => ({
    ...await importOriginal<typeof import('@impos2/kernel-base-runtime-shell-v2')>(),
    defineCommand: defineCommandMock,
    createCommand: createCommandMock,
}))

vi.mock('@impos2/kernel-base-ui-runtime-v2', async importOriginal => ({
    ...await importOriginal<typeof import('@impos2/kernel-base-ui-runtime-v2')>(),
    selectUiScreen: selectUiScreenMock,
    selectUiOverlays: selectUiOverlaysMock,
}))

vi.mock('../../src/turbomodules/scripts', () => ({
    nativeScriptExecutor: {
        execute: nativeScriptExecuteMock,
    },
}))

import {createAutomationJsonRpcClient} from '@impos2/ui-base-automation-runtime'
import {createAutomationRequestDispatcher} from '../../src/application/automation'

describe('assembly automation dispatcher', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        nativeScriptExecuteMock.mockResolvedValue({ok: true})
    })

    it('handles query, wait, command and script methods through JSON-RPC', async () => {
        const requestListeners = new Set<(request: any) => void>()
        const stateListeners = new Set<() => void>()
        const runtime = {
            runtimeId: 'primary-runtime',
            localNodeId: 'node-primary',
            environmentMode: 'TEST',
            displayContext: {displayIndex: 0, displayCount: 2},
            getState: () => ({
                kernel: {
                    test: {
                        status: 'ready',
                    },
                },
            }),
            queryRequest: vi.fn((requestId: string) => requestId === 'req-1'
                ? {
                    requestId: 'req-1',
                    rootCommandId: 'cmd-1',
                    status: 'COMPLETED',
                    startedAt: 1,
                    updatedAt: 2,
                    commands: [],
                }
                : undefined),
            subscribeRequests: vi.fn((listener: (request: any) => void) => {
                requestListeners.add(listener)
                listener({
                    requestId: 'req-1',
                    rootCommandId: 'cmd-1',
                    status: 'COMPLETED',
                    startedAt: 1,
                    updatedAt: 2,
                    commands: [],
                })
                return () => {
                    requestListeners.delete(listener)
                }
            }),
            subscribeState: vi.fn((listener: () => void) => {
                stateListeners.add(listener)
                return () => {
                    stateListeners.delete(listener)
                }
            }),
            dispatchCommand: vi.fn(async () => ({status: 'COMPLETED'})),
        }

        const dispatcher = createAutomationRequestDispatcher({
            app: {} as any,
            buildProfile: 'test',
            automationEnabled: true,
            scriptExecutionAvailable: true,
            performNodeAction: vi.fn(async action => ({ok: true, action})),
        })
        dispatcher.attachRuntime({
            target: 'primary',
            runtimeId: 'primary-runtime',
            runtime: runtime as any,
        })
        dispatcher.registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-runtime',
            screenKey: 'home',
            mountId: 'mount-home-submit',
            nodeId: 'home.submit',
            testID: 'home.submit',
            semanticId: 'home.submit',
            role: 'button',
            text: 'Submit',
            visible: true,
            enabled: true,
            availableActions: ['press', 'scroll'],
        })

        const client = createAutomationJsonRpcClient(dispatcher)

        await expect(client.call('session.hello')).resolves.toMatchObject({
            protocolVersion: 1,
            buildProfile: 'test',
        })
        await expect(client.call('runtime.getInfo', {target: 'primary'})).resolves.toMatchObject({
            runtimeId: 'primary-runtime',
        })
        await expect(client.call('runtime.selectState', {
            target: 'primary',
            path: ['kernel', 'test', 'status'],
        })).resolves.toBe('ready')
        await expect(client.call('runtime.listRequests', {target: 'primary'})).resolves.toMatchObject([
            {
                requestId: 'req-1',
                status: 'COMPLETED',
            },
        ])
        await expect(client.call('wait.forNode', {
            target: 'primary',
            testID: 'home.submit',
        })).resolves.toMatchObject({
            nodeId: 'home.submit',
        })
        await expect(client.call('wait.forScreen', {
            target: 'primary',
            partKey: 'home',
        })).resolves.toMatchObject({
            screen: {
                partKey: 'home',
            },
        })
        await expect(client.call('wait.forState', {
            target: 'primary',
            path: ['kernel', 'test', 'status'],
            equals: 'ready',
        })).resolves.toMatchObject({
            value: 'ready',
        })
        await expect(client.call('wait.forRequest', {
            target: 'primary',
            requestId: 'req-1',
            status: 'COMPLETED',
        })).resolves.toMatchObject({
            requestId: 'req-1',
        })
        await expect(client.call('ui.performAction', {
            target: 'primary',
            nodeId: 'home.submit',
            action: 'press',
        })).resolves.toMatchObject({
            ok: true,
            nodeId: 'home.submit',
        })
        await expect(client.call('command.dispatch', {
            target: 'primary',
            commandName: 'app.test.command',
            payload: {value: 1},
        })).resolves.toMatchObject({
            status: 'COMPLETED',
        })
        await expect(client.call('scripts.execute', {
            source: 'return 1',
            timeoutMs: 1000,
        })).resolves.toMatchObject({
            ok: true,
        })
        await expect(client.call('events.subscribe', {
            target: 'primary',
            topic: 'runtime.stateChanged',
            sessionId: 'session-1',
        })).resolves.toMatchObject({
            subscriptionId: expect.any(String),
        })
        await expect(client.call('automation.getTraceHistory', {
            limit: 10,
        })).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({
                step: 'scripts.execute',
            }),
        ]))
    })

    it('guards scripts.execute in product mode', async () => {
        const dispatcher = createAutomationRequestDispatcher({
            app: {} as any,
            buildProfile: 'product',
            automationEnabled: false,
            scriptExecutionAvailable: true,
        })
        const client = createAutomationJsonRpcClient(dispatcher)

        await expect(client.call('scripts.execute', {
            source: 'return 1',
        })).rejects.toThrow(/not available/i)
    })
})
