import {describe, expect, it} from 'vitest'
import {createSemanticRegistry} from '../../src/foundations/semanticRegistry'

describe('semantic registry lifecycle', () => {
    it('removes nodes on unmount', () => {
        const registry = createSemanticRegistry()
        const unregister = registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'home',
            mountId: 'mount-1',
            nodeId: 'node-1',
            testID: 'button.submit',
            visible: true,
            enabled: true,
            availableActions: ['press'],
        })

        expect(registry.queryNodes({target: 'primary', testID: 'button.submit'})).toHaveLength(1)
        unregister()
        expect(registry.queryNodes({target: 'primary', testID: 'button.submit'})).toHaveLength(0)
    })

    it('clears non-persistent nodes when the screen changes', () => {
        const registry = createSemanticRegistry()
        registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'home',
            mountId: 'mount-1',
            nodeId: 'node-1',
            testID: 'home.button',
            visible: true,
            enabled: true,
            availableActions: ['press'],
        })
        registry.registerNode({
            target: 'primary',
            runtimeId: 'primary-1',
            screenKey: 'global',
            mountId: 'mount-2',
            nodeId: 'node-2',
            testID: 'global.overlay',
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: ['press'],
        })

        registry.clearScreenContext('primary', ['detail', 'global'])

        expect(registry.queryNodes({target: 'primary', testID: 'home.button'})).toHaveLength(0)
        expect(registry.queryNodes({target: 'primary', testID: 'global.overlay'})).toHaveLength(1)
    })

    it('marks old node ids stale after target reset', () => {
        const registry = createSemanticRegistry()
        registry.registerNode({
            target: 'secondary',
            runtimeId: 'secondary-1',
            screenKey: 'welcome',
            mountId: 'mount-1',
            nodeId: 'node-1',
            testID: 'secondary.title',
            visible: true,
            enabled: true,
            availableActions: [],
        })

        registry.clearTarget('secondary')

        expect(registry.getNode('secondary', 'node-1')?.stale).toBe(true)
        expect(registry.queryNodes({target: 'secondary', testID: 'secondary.title'})).toHaveLength(0)
    })
})
