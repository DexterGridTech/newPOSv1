import {describe, expect, it} from 'vitest'
import {createCommand, createKernelRuntimeV2} from '@next/kernel-base-runtime-shell-v2'
import {createPlatformPorts} from '@next/kernel-base-platform-ports'
import {createLoggerPort} from '@next/kernel-base-platform-ports'
import {createTopologyRuntimeModuleV3} from '@next/kernel-base-topology-runtime-v3'
import {topologyRuntimeV3CommandDefinitions} from '@next/kernel-base-topology-runtime-v3'
import {
    createUiAlertDefinition,
    createUiAlertScreen,
    createUiModalScreen,
    createUiRuntimeModuleV2,
    registerUiScreenDefinitions,
    registerUiScreenDefinition,
    selectFirstReadyUiScreenDefinition,
    selectUiCurrentScreenOrFirstReady,
    selectUiOverlays,
    selectUiScreenRendererKey,
    selectUiScreen,
    selectUiScreenDefinition,
    selectUiScreenDefinitionsByContainer,
    selectUiVariable,
    uiRuntimeV2CommandDefinitions,
    type UiScreenDefinition,
} from '../../src'

const createTestLogger = (moduleName: string) => createLoggerPort({
    environmentMode: 'TEST',
    write() {},
    scope: {
        moduleName,
        layer: 'kernel',
    },
})

const checkoutScreen: UiScreenDefinition = {
    partKey: 'checkout.main',
    rendererKey: 'ui.checkout.main',
    name: 'Checkout Main',
    title: 'Checkout Main',
    description: 'Checkout screen',
    containerKey: 'main-root',
    indexInContainer: 0,
    screenModes: ['DESKTOP'],
    workspaces: ['main'],
    instanceModes: ['MASTER'],
}

const secondaryAlertScreen: UiScreenDefinition = {
    partKey: 'alert.secondary',
    rendererKey: 'ui.alert.secondary',
    name: 'Secondary Alert',
    title: 'Secondary Alert',
    description: 'Alert screen',
    containerKey: 'secondary-root',
    indexInContainer: 0,
    screenModes: ['DESKTOP'],
    workspaces: ['branch'],
    instanceModes: ['SLAVE'],
}

const tertiaryReadyScreen: UiScreenDefinition = {
    partKey: 'checkout.fallback',
    rendererKey: 'ui.checkout.fallback',
    name: 'Checkout Fallback',
    title: 'Checkout Fallback',
    description: 'Fallback checkout screen',
    containerKey: 'main-root',
    indexInContainer: 1,
    screenModes: ['DESKTOP'],
    workspaces: ['main'],
    instanceModes: ['MASTER'],
}

describe('ui-runtime-v2', () => {
    it('keeps screen definition list references stable until registry definitions change', async () => {
        const containerKey = 'stable-container'
        const firstScreen: UiScreenDefinition = {
            ...checkoutScreen,
            partKey: 'stable.checkout.first',
            rendererKey: 'ui.stable.checkout.first',
            containerKey,
            indexInContainer: 0,
        }
        const secondScreen: UiScreenDefinition = {
            ...checkoutScreen,
            partKey: 'stable.checkout.second',
            rendererKey: 'ui.stable.checkout.second',
            containerKey,
            indexInContainer: 1,
        }

        registerUiScreenDefinition(firstScreen)

        const runtime = createKernelRuntimeV2({
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'TEST',
                logger: createTestLogger('kernel.base.ui-runtime-v2.test.registry-cache'),
            }),
            modules: [
                createTopologyRuntimeModuleV3(),
                createUiRuntimeModuleV2(),
            ],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setInstanceMode, {
            instanceMode: 'MASTER',
        }))

        const firstList = selectUiScreenDefinitionsByContainer(runtime.getState(), containerKey)
        const secondList = selectUiScreenDefinitionsByContainer(runtime.getState(), containerKey)
        expect(secondList).toBe(firstList)
        expect(secondList.map(definition => definition.partKey)).toEqual(['stable.checkout.first'])

        registerUiScreenDefinition(secondScreen)

        const thirdList = selectUiScreenDefinitionsByContainer(runtime.getState(), containerKey)
        expect(thirdList).not.toBe(firstList)
        expect(thirdList.map(definition => definition.partKey)).toEqual([
            'stable.checkout.first',
            'stable.checkout.second',
        ])
        expect(selectUiScreenDefinitionsByContainer(runtime.getState(), containerKey)).toBe(thirdList)
    })

    it('registers screen definitions and drives screen/overlay/ui-variable state through commands', async () => {
        registerUiScreenDefinitions([checkoutScreen, secondaryAlertScreen])
        registerUiScreenDefinition(tertiaryReadyScreen)

        const runtime = createKernelRuntimeV2({
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'TEST',
                logger: createTestLogger('kernel.base.ui-runtime-v2.test'),
            }),
            modules: [
                createTopologyRuntimeModuleV3(),
                createUiRuntimeModuleV2(),
            ],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setInstanceMode, {
            instanceMode: 'MASTER',
        }))
        await runtime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
            displayMode: 'PRIMARY',
        }))

        expect(selectUiScreenDefinition(checkoutScreen.partKey)?.rendererKey).toBe('ui.checkout.main')
        expect(selectUiScreenRendererKey(checkoutScreen.partKey)).toBe('ui.checkout.main')
        expect(selectFirstReadyUiScreenDefinition(runtime.getState(), 'main-root')?.partKey).toBe(checkoutScreen.partKey)
        expect(selectUiCurrentScreenOrFirstReady(runtime.getState(), 'main-root')).toMatchObject({
            partKey: checkoutScreen.partKey,
        })

        expect((await runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.showScreen,
            {
                definition: checkoutScreen,
                id: 'screen-1',
                props: {orderNo: 'A001'},
                source: 'test',
            },
        ))).status).toBe('COMPLETED')

        expect(selectUiScreen(runtime.getState(), 'main-root')).toMatchObject({
            partKey: checkoutScreen.partKey,
            rendererKey: checkoutScreen.rendererKey,
            id: 'screen-1',
            source: 'test',
            operation: 'show',
        })
        expect(selectUiCurrentScreenOrFirstReady(runtime.getState(), 'main-root')).toMatchObject({
            partKey: checkoutScreen.partKey,
            id: 'screen-1',
        })

        expect((await runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.openOverlay,
            {
                definition: checkoutScreen,
                id: 'overlay-1',
                props: {kind: 'confirm'},
            },
        ))).status).toBe('COMPLETED')

        expect(selectUiOverlays(runtime.getState())).toHaveLength(1)
        expect(selectUiOverlays(runtime.getState())[0]).toMatchObject({
            id: 'overlay-1',
            screenPartKey: checkoutScreen.partKey,
        })

        expect((await runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.openOverlay,
            {
                definition: checkoutScreen,
                id: 'overlay-2',
                props: {kind: 'secondary'},
            },
        ))).status).toBe('COMPLETED')

        expect(selectUiOverlays(runtime.getState())).toHaveLength(2)

        expect((await runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.closeOverlay,
            {
                overlayId: 'overlay-1',
            },
        ))).status).toBe('COMPLETED')

        expect(selectUiOverlays(runtime.getState())).toHaveLength(1)
        expect(selectUiOverlays(runtime.getState())[0]?.id).toBe('overlay-2')

        const modalOverlay = createUiModalScreen(checkoutScreen, 'overlay-helper', {
            kind: 'helper',
        })
        expect(modalOverlay).toMatchObject({
            id: 'overlay-helper',
            screenPartKey: checkoutScreen.partKey,
            rendererKey: checkoutScreen.rendererKey,
        })

        const alertDefinition = createUiAlertDefinition()
        const alertOverlay = createUiAlertScreen('alert-1', {
            title: 'Alert',
            message: 'Need attention',
        }, alertDefinition)
        expect(alertOverlay).toMatchObject({
            id: 'alert-1',
            screenPartKey: 'alert',
            rendererKey: 'ui.alert.default',
        })

        expect((await runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.setUiVariables,
            {
                orderNo: 'A001',
                note: 'cash only',
            },
        ))).status).toBe('COMPLETED')

        expect(selectUiVariable(runtime.getState(), 'orderNo')).toBe('A001')
        expect(selectUiVariable(runtime.getState(), 'note')).toBe('cash only')

        expect((await runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.clearUiVariables,
            ['note'],
        ))).status).toBe('COMPLETED')
        expect(selectUiVariable(runtime.getState(), 'note', 'default')).toBeNull()

        expect((await runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.clearUiVariables,
            ['orderNo'],
        ))).status).toBe('COMPLETED')
        expect(selectUiVariable(runtime.getState(), 'orderNo')).toBeNull()

        expect((await runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.resetScreen,
            {
                containerKey: 'main-root',
            },
        ))).status).toBe('COMPLETED')
        expect(selectUiScreen(runtime.getState(), 'main-root', 'fallback' as any)).toBeNull()
    })

    it('filters fallback screen definitions by current instance mode', async () => {
        registerUiScreenDefinitions([checkoutScreen, secondaryAlertScreen, tertiaryReadyScreen])

        const runtime = createKernelRuntimeV2({
            displayContext: {
                displayIndex: 0,
                displayCount: 1,
            },
            platformPorts: createPlatformPorts({
                environmentMode: 'TEST',
                logger: createTestLogger('kernel.base.ui-runtime-v2.test.instance-mode'),
            }),
            modules: [
                createTopologyRuntimeModuleV3(),
                createUiRuntimeModuleV2(),
            ],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setInstanceMode, {
            instanceMode: 'SLAVE',
        }))
        await runtime.dispatchCommand(createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
            displayMode: 'PRIMARY',
        }))

        expect(selectUiCurrentScreenOrFirstReady(runtime.getState(), 'main-root')).toBeUndefined()
        expect(selectUiCurrentScreenOrFirstReady(runtime.getState(), 'secondary-root')).toMatchObject({
            partKey: secondaryAlertScreen.partKey,
        })
    })
})
