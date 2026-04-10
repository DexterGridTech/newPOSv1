import {
    createCommandId,
    createRequestId,
} from '@impos2/kernel-base-contracts'
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createExecutionCommand,
    createExecutionRuntime,
    createInternalExecutionCommand,
    packageVersion,
} from '../src'

const lifecycle: string[] = []

const runtime = createExecutionRuntime({
    logger: createLoggerPort({
        environmentMode: 'DEV',
        write: () => {},
        scope: {moduleName: 'kernel.base.execution-runtime.test', layer: 'kernel'},
    }),
    onLifecycleEvent: event => {
        lifecycle.push(event.eventType)
    },
})

runtime.registerHandler('kernel.base.execution-runtime.test.echo', async context => {
    if (lifecycle[0] !== 'started') {
        throw new Error('Request lifecycle must start synchronously before handler body')
    }

    return {echo: context.command.payload}
})

const main = async () => {
    const normalResult = await runtime.execute(
        createExecutionCommand({
            commandId: createCommandId(),
            requestId: createRequestId(),
            commandName: 'kernel.base.execution-runtime.test.echo',
            payload: {ok: true},
        }),
    )

    const internalResult = await runtime.execute(
        createInternalExecutionCommand({
            commandId: createCommandId(),
            commandName: 'kernel.base.execution-runtime.test.echo',
            payload: {internal: true},
        }),
    )

    if (normalResult.status !== 'completed' || internalResult.status !== 'completed') {
        throw new Error('Execution runtime did not complete expected commands')
    }

    console.log('[execution-runtime-test-scenario]', {
        packageName: '@impos2/kernel-base-execution-runtime',
        packageVersion,
        lifecycle,
        journal: runtime.getJournal().list(),
        normalResult,
        internalResult,
    })
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
