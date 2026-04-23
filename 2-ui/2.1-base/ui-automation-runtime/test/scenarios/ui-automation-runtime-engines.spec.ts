import {describe, expect, it} from 'vitest'
import {createSemanticRegistry} from '../../src/foundations/semanticRegistry'
import {createQueryEngine} from '../../src/foundations/queryEngine'
import {createActionExecutor} from '../../src/foundations/actionExecutor'
import {createWaitEngine} from '../../src/foundations/waitEngine'
import {createAutomationTrace} from '../../src/foundations/automationTrace'

describe('automation query/action/wait engines', () => {
    it('queries nodes and rejects stale action targets', async () => {
        const registry = createSemanticRegistry()
        const trace = createAutomationTrace()
        const queryEngine = createQueryEngine({registry, trace})
        const actionExecutor = createActionExecutor({registry, trace})
        const unregister = registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'home',
            mountId: 'mount-1',
            nodeId: 'submit',
            testID: 'home.submit',
            visible: true,
            enabled: true,
            availableActions: ['press'],
        })

        expect(queryEngine.queryNodes({target: 'primary', testID: 'home.submit'})).toHaveLength(1)
        unregister()

        await expect(actionExecutor.performAction({
            target: 'primary',
            nodeId: 'submit',
            action: 'press',
        })).rejects.toThrow(/STALE_NODE/)
        expect(trace.getLastTrace()?.status).toBe('failed')
    })

    it('waits for idle after quiet window', async () => {
        const trace = createAutomationTrace()
        const waitEngine = createWaitEngine({
            trace,
            quietWindowMs: 5,
            getPendingRequestCount: () => 0,
            getInFlightActionCount: () => 0,
            getInFlightScriptCount: () => 0,
            subscribeToRuntimeEvents: () => () => {},
        })
        const result = await waitEngine.forIdle({target: 'primary', timeoutMs: 100})

        expect(result.ok).toBe(true)
    })

    it('delegates validated actions to the host action performer', async () => {
        const registry = createSemanticRegistry()
        const trace = createAutomationTrace()
        const performed: unknown[] = []
        const actionExecutor = createActionExecutor({
            registry,
            trace,
            performNodeAction: action => {
                performed.push(action)
            },
        })
        registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'home',
            mountId: 'mount-1',
            nodeId: 'field',
            testID: 'home.field',
            visible: true,
            enabled: true,
            availableActions: ['changeText'],
        })

        await actionExecutor.performAction({
            target: 'primary',
            nodeId: 'field',
            action: 'changeText',
            value: 'hello',
        })

        expect(performed).toEqual([{
            target: 'primary',
            nodeId: 'field',
            action: 'changeText',
            value: 'hello',
        }])
    })

    it('fails when the delegated action handler rejects the action', async () => {
        const registry = createSemanticRegistry()
        const trace = createAutomationTrace()
        const actionExecutor = createActionExecutor({
            registry,
            trace,
            performNodeAction: () => ({ok: false, reason: 'NO_ACTION_HANDLER'}),
        })
        registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'home',
            mountId: 'mount-1',
            nodeId: 'field',
            testID: 'home.field',
            visible: true,
            enabled: true,
            availableActions: ['changeText'],
        })

        await expect(actionExecutor.performAction({
            target: 'primary',
            nodeId: 'field',
            action: 'changeText',
            value: 'hello',
        })).rejects.toThrow(/NO_ACTION_HANDLER/)
        expect(trace.getLastTrace()?.status).toBe('failed')
    })
})
