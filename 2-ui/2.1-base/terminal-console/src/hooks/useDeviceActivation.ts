import {useCallback, useMemo, useState} from 'react'
import {createCommand, type KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import type {TerminalActivationModel} from '../types'

const normalizeActivationCode = (value: string): string =>
    value.toUpperCase().replace(/[^0-9A-Z]/g, '')

export const useDeviceActivation = (
    runtime: KernelRuntimeV2,
): TerminalActivationModel => {
    const [activationCode, setActivationCode] = useState('')
    const [isSubmitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | undefined>()

    const submit = useCallback(async () => {
        if (isSubmitting || activationCode.length < 6) {
            return
        }
        setSubmitting(true)
        setErrorMessage(undefined)
        try {
            const result = await runtime.dispatchCommand(
                createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
                    activationCode,
                }),
            )
            if (result.status !== 'COMPLETED') {
                setErrorMessage('终端激活失败')
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '终端激活失败')
        } finally {
            setSubmitting(false)
        }
    }, [activationCode, isSubmitting, runtime])

    return useMemo(() => ({
        activationCode,
        isSubmitting,
        canSubmit: activationCode.length >= 6 && !isSubmitting,
        errorMessage,
        setActivationCode(value: string) {
            setActivationCode(normalizeActivationCode(value))
        },
        submit,
    }), [activationCode, errorMessage, isSubmitting, submit])
}
