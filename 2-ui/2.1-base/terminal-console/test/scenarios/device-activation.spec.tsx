import React from 'react'
import {act, create} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import type {TerminalActivationModel} from '../../src'
import {useDeviceActivation} from '../../src'
import {createTerminalConsoleHarness} from '../support/terminalConsoleHarness'

const HookProbe: React.FC<{
    runtime: Parameters<typeof useDeviceActivation>[0]
    onModel(model: TerminalActivationModel): void
}> = ({runtime, onModel}) => {
    const model = useDeviceActivation(runtime)
    onModel(model)
    return null
}

describe('useDeviceActivation', () => {
    it('keeps short activation codes local and does not dispatch command', async () => {
        const harness = await createTerminalConsoleHarness()
        const dispatched: unknown[] = []
        const runtime = {
            ...harness.runtime,
            dispatchCommand: async (command: unknown) => {
                dispatched.push(command)
                return {status: 'COMPLETED'}
            },
        } as typeof harness.runtime
        let model: TerminalActivationModel | undefined

        create(<HookProbe runtime={runtime} onModel={(value) => {
            model = value
        }} />)

        await act(async () => {
            model?.setActivationCode('123')
        })
        await act(async () => {
            await model?.submit()
        })

        expect(dispatched).toHaveLength(0)
        expect(model?.canSubmit).toBe(false)
    })

    it('dispatches terminal activation command when code is long enough', async () => {
        const harness = await createTerminalConsoleHarness()
        const dispatched: unknown[] = []
        const runtime = {
            ...harness.runtime,
            dispatchCommand: async (command: unknown) => {
                dispatched.push(command)
                return {status: 'COMPLETED'}
            },
        } as typeof harness.runtime
        let model: TerminalActivationModel | undefined

        create(<HookProbe runtime={runtime} onModel={(value) => {
            model = value
        }} />)

        await act(async () => {
            model?.setActivationCode('abc123??')
        })
        await act(async () => {
            await model?.submit()
        })

        expect(dispatched).toEqual([
            createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
                activationCode: 'ABC123',
            }),
        ])
        expect(model?.errorMessage).toBeUndefined()
    })

    it('stores dispatch errors as readable message', async () => {
        const harness = await createTerminalConsoleHarness()
        const runtime = {
            ...harness.runtime,
            dispatchCommand: async () => {
                throw new Error('activation-code-invalid')
            },
        } as typeof harness.runtime
        let model: TerminalActivationModel | undefined

        create(<HookProbe runtime={runtime} onModel={(value) => {
            model = value
        }} />)

        await act(async () => {
            model?.setActivationCode('A1B2C3')
        })
        await act(async () => {
            await model?.submit()
        })

        expect(model?.errorMessage).toBe('activation-code-invalid')
        expect(model?.canSubmit).toBe(true)
    })
})
