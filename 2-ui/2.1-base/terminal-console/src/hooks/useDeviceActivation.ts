import {useCallback, useMemo, useState} from 'react'
import {shallowEqual, useSelector} from 'react-redux'
import {createCommand, type KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {
    selectTopologyRuntimeV3TcpActivationEligibility,
    type TopologyV3ActivationStatus,
} from '@impos2/kernel-base-topology-runtime-v3'
import {
    selectTcpIdentitySnapshot,
    tcpControlV2CommandDefinitions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import type {TerminalActivationModel} from '../types'

const normalizeActivationCode = (value: string): string =>
    value.toUpperCase().replace(/[^0-9A-Z]/g, '')

const normalizeSandboxId = (value: string): string =>
    value.toLowerCase().replace(/[^0-9a-z_-]/g, '')

const activationEligibilityMessages: Record<string, string> = {
    'managed-secondary': '当前是托管副屏，托管副屏不参与激活。',
    'slave-instance': '当前是副机，副机不允许激活，请先切回主机。',
    'already-activated': '当前设备已激活，如需改为副机，请先解除激活。',
    'master-unactivated': '请向管理员索取激活码。激活成功后，本机将自动进入业务欢迎页。',
}

export const useDeviceActivation = (
    runtime: KernelRuntimeV2,
): TerminalActivationModel => {
    const [sandboxId, setSandboxId] = useState('')
    const [activationCode, setActivationCode] = useState('')
    const [isSubmitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | undefined>()
    const activationStatus = useSelector((state: RootState) =>
        selectTcpIdentitySnapshot(state).activationStatus,
    )
    const eligibility = useSelector(
        (state: RootState) =>
            selectTopologyRuntimeV3TcpActivationEligibility(state, activationStatus as TopologyV3ActivationStatus),
        shallowEqual,
    )

    const submit = useCallback(async () => {
        if (
            isSubmitting
            || !eligibility.allowed
            || sandboxId.length < 3
            || activationCode.length < 6
        ) {
            return
        }
        setSubmitting(true)
        setErrorMessage(undefined)
        try {
            const result = await runtime.dispatchCommand(
                createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
                    sandboxId,
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
    }, [activationCode, eligibility.allowed, isSubmitting, runtime, sandboxId])

    return useMemo(() => {
        const eligibilityMessage = activationEligibilityMessages[eligibility.reasonCode]
            ?? activationEligibilityMessages['master-unactivated']
        const inputDisabled = !eligibility.allowed || isSubmitting
        const canSubmit = eligibility.allowed
            && sandboxId.length >= 3
            && activationCode.length >= 6
            && !isSubmitting

        return {
            sandboxId,
            activationCode,
            isSubmitting,
            canSubmit,
            activationStatus,
            eligibilityAllowed: eligibility.allowed,
            eligibilityReasonCode: eligibility.reasonCode,
            eligibilityMessage,
            inputDisabled,
            submitLabel: isSubmitting
                ? '激活中...'
                : activationStatus === 'ACTIVATED'
                    ? '已激活'
                    : '立即激活',
            errorMessage,
            setSandboxId(value: string) {
                if (inputDisabled) {
                    return
                }
                setSandboxId(normalizeSandboxId(value))
            },
            setActivationCode(value: string) {
                if (inputDisabled) {
                    return
                }
                setActivationCode(normalizeActivationCode(value))
            },
            submit,
        }
    }, [
        activationCode,
        activationStatus,
        eligibility.allowed,
        eligibility.reasonCode,
        errorMessage,
        isSubmitting,
        sandboxId,
        submit,
    ])
}
