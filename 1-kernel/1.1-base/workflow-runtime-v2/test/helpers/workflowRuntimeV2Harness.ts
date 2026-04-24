import {setTimeout as delay} from 'node:timers/promises'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {createLoggerPort, createPlatformPorts, type CreatePlatformPortsInput} from '@next/kernel-base-platform-ports'
import {createNodeId} from '@next/kernel-base-contracts'
import {
    createKernelRuntimeV2,
    defineCommand,
    type ActorDefinition,
    type KernelRuntimeModuleV2,
} from '@next/kernel-base-runtime-shell-v2'

export const CHILD_SLICE = 'kernel.base.workflow-runtime-v2.test.child-state'
export const CHILD_MODULE_NAME = 'kernel.base.workflow-runtime-v2.test.child-command'

export const childAppendCommand = defineCommand<{value: string}>({
    moduleName: CHILD_MODULE_NAME,
    commandName: 'append',
})

export const childDelayCommand = defineCommand<{
    value: string
    delayMs: number
}>({
    moduleName: CHILD_MODULE_NAME,
    commandName: 'delay',
})

const childSlice = createSlice({
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

export const createChildCommandModule = (): KernelRuntimeModuleV2 => {
    const actors: ActorDefinition[] = [
        {
            moduleName: CHILD_MODULE_NAME,
            actorName: 'ChildCommandActor',
            handlers: [
                {
                    commandName: childAppendCommand.commandName,
                    handle(context) {
                        context.dispatchAction(childSlice.actions.appendValue(context.command.payload.value))
                        return {
                            appended: context.command.payload.value,
                        }
                    },
                },
                {
                    commandName: childDelayCommand.commandName,
                    async handle(context) {
                        await delay(context.command.payload.delayMs)
                        context.dispatchAction(childSlice.actions.appendValue(context.command.payload.value))
                        return {
                            delayed: context.command.payload.value,
                        }
                    },
                },
            ],
        },
    ]

    return {
        moduleName: CHILD_MODULE_NAME,
        packageVersion: '0.0.1',
        stateSlices: [
            {
                name: CHILD_SLICE,
                reducer: childSlice.reducer,
                persistIntent: 'never',
                syncIntent: 'isolated',
            },
        ],
        commandDefinitions: [
            childAppendCommand,
            childDelayCommand,
        ],
        actorDefinitions: actors,
    }
}

export const createTestRuntime = (
    modules: KernelRuntimeModuleV2[],
    platformPortsInput?: Partial<CreatePlatformPortsInput>,
) => createKernelRuntimeV2({
    localNodeId: createNodeId(),
    platformPorts: createPlatformPorts({
        environmentMode: 'DEV',
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write() {},
            scope: {
                moduleName: 'kernel.base.workflow-runtime-v2.test',
                layer: 'kernel',
            },
        }),
        ...platformPortsInput,
    }),
    modules,
})
