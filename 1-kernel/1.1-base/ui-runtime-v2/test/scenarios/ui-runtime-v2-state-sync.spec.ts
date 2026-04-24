import {describe, expect, it} from 'vitest'
import {
    applySliceSyncDiff,
    createSliceSyncDiff,
    createSliceSyncSummary,
} from '@next/kernel-base-state-runtime'
import {
    uiRuntimeV2OverlayStateSlices,
    uiRuntimeV2ScreenStateSlices,
    uiRuntimeV2VariableStateSlices,
} from '../../src/features/slices'
import type {UiScreenRuntimeEntry} from '../../src'

describe('ui-runtime-v2 state sync', () => {
    it('syncs screen and ui-variable record states including explicit null values', () => {
        const screenDescriptor = uiRuntimeV2ScreenStateSlices[0]
        const variableDescriptor = uiRuntimeV2VariableStateSlices[0]

        const sourceScreenState = {
            'main-root': {
                value: {
                    partKey: 'checkout.main',
                    rendererKey: 'ui.checkout.main',
                    name: 'Checkout Main',
                    title: 'Checkout Main',
                    description: 'Checkout screen',
                    containerKey: 'main-root',
                    operation: 'show',
                } satisfies UiScreenRuntimeEntry,
                updatedAt: 100,
            },
        }

        const sourceVariableState = {
            note: {
                value: null,
                updatedAt: 200,
            },
            orderNo: {
                value: 'A001',
                updatedAt: 201,
            },
        }

        const targetScreenState = {}
        const targetVariableState = {
            note: {
                value: 'old',
                updatedAt: 10,
            },
        }

        const nextScreen = applySliceSyncDiff(
            screenDescriptor,
            targetScreenState,
            createSliceSyncDiff(
                screenDescriptor,
                sourceScreenState,
                createSliceSyncSummary(screenDescriptor, targetScreenState),
            ),
        )
        const nextVariables = applySliceSyncDiff(
            variableDescriptor,
            targetVariableState,
            createSliceSyncDiff(
                variableDescriptor,
                sourceVariableState,
                createSliceSyncSummary(variableDescriptor, targetVariableState),
            ),
        )

        expect(nextScreen).toEqual(sourceScreenState)
        expect(nextVariables).toEqual(sourceVariableState)
    })

    it('syncs overlay snapshot state through record descriptor', () => {
        const overlayDescriptor = uiRuntimeV2OverlayStateSlices[0]
        const sourceState = {
            primaryOverlays: {
                value: [
                    {
                        id: 'overlay-1',
                        screenPartKey: 'checkout.main',
                        rendererKey: 'ui.checkout.main',
                        openedAt: 100,
                    },
                ],
                updatedAt: 100,
            },
            secondaryOverlays: {
                value: [],
                updatedAt: 99,
            },
        }

        const targetState = {
            primaryOverlays: {
                value: [],
                updatedAt: 1,
            },
            secondaryOverlays: {
                value: [],
                updatedAt: 1,
            },
        }

        const nextState = applySliceSyncDiff(
            overlayDescriptor,
            targetState,
            createSliceSyncDiff(
                overlayDescriptor,
                sourceState,
                createSliceSyncSummary(overlayDescriptor, targetState),
            ),
        )

        expect(nextState).toEqual(sourceState)
    })
})
