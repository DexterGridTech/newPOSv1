import React from 'react'
import {describe, expect, it} from 'vitest'
import {
    createRendererRegistry,
    defineUiScreenPart,
    runtimeReactDefaultParts,
} from '../../src'

describe('runtime-react screen part registration', () => {
    it('separates kernel definitions from local renderer lookup', () => {
        const SampleScreen: React.FC = () => null
        const part = defineUiScreenPart({
            partKey: 'sample',
            rendererKey: 'sample',
            name: 'sample',
            title: 'Sample',
            description: 'Sample screen',
            screenModes: ['DESKTOP'],
            workspaces: ['main'],
            instanceModes: ['MASTER'],
            component: SampleScreen,
        })

        const registry = createRendererRegistry()
        const definitions = registry.registerParts([part])

        expect(definitions).toHaveLength(1)
        expect(definitions[0]?.partKey).toBe('sample')
        expect(registry.resolve('sample')).toBe(SampleScreen)
    })

    it('ships stable default parts for empty screen, alert and hot update modal rendering', () => {
        expect(runtimeReactDefaultParts.emptyScreen.definition.partKey).toBe('ui.base.empty-screen')
        expect(runtimeReactDefaultParts.defaultAlert.definition.partKey).toBe('ui.base.default-alert')
        expect(runtimeReactDefaultParts.hotUpdateProgressModal.definition.partKey)
            .toBe('ui.base.hot-update-progress-modal')
    })
})
