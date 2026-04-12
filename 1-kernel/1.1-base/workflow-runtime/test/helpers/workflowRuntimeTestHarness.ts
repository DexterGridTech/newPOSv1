import {setTimeout as delay} from 'node:timers/promises'
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'

export const CHILD_SLICE = 'kernel.base.workflow-runtime.test.child-state'

export const childSlice = createSlice({
    name: CHILD_SLICE,
    initialState: {
        values: [] as string[],
    },
    reducers: {
        appendValue(state, action: PayloadAction<string>) {
            state.values.push(action.payload)
        },
    },
})

export const createTestLogger = (moduleName: string) => createLoggerPort({
    environmentMode: 'DEV',
    write() {},
    scope: {
        moduleName,
        layer: 'kernel',
    },
})

export const createChildCommandModule = (): KernelRuntimeModule => ({
    moduleName: 'kernel.base.workflow-runtime.test.child-command',
    packageVersion: '0.0.1',
    stateSlices: [
        {
            name: CHILD_SLICE,
            reducer: childSlice.reducer,
            persistIntent: 'never',
            syncIntent: 'isolated',
        },
    ],
    commands: [
        {
            name: 'kernel.base.workflow-runtime.test.child-command.append',
            visibility: 'public',
        },
        {
            name: 'kernel.base.workflow-runtime.test.child-command.delay',
            visibility: 'public',
        },
    ],
    install(context) {
        context.registerHandler(
            'kernel.base.workflow-runtime.test.child-command.append',
            async handlerContext => {
                const payload = handlerContext.command.payload as {value: string}
                context.dispatchAction(childSlice.actions.appendValue(payload.value))
                return {
                    appended: payload.value,
                }
            },
        )

        context.registerHandler(
            'kernel.base.workflow-runtime.test.child-command.delay',
            async handlerContext => {
                const payload = handlerContext.command.payload as {
                    value: string
                    delayMs: number
                }
                await delay(payload.delayMs)
                context.dispatchAction(childSlice.actions.appendValue(payload.value))
                return {
                    delayed: payload.value,
                }
            },
        )
    },
})
