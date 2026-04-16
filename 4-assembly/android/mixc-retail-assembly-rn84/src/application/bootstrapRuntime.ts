import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {topologyRuntimeV2CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v2'
import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {AppProps} from '../types'

export const bootstrapAssemblyRuntime = async (
    runtime: KernelRuntimeV2,
    props: AppProps,
): Promise<void> => {
    if (props.displayIndex === 0 && props.displayCount > 1) {
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV2CommandDefinitions.setEnableSlave,
            {enableSlave: true},
        ))
    }

    if (props.displayIndex > 0) {
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV2CommandDefinitions.setInstanceMode,
            {instanceMode: 'SLAVE'},
        ))
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV2CommandDefinitions.setDisplayMode,
            {displayMode: 'SECONDARY'},
        ))
    }

    if (props.topology?.wsUrl && props.topology.role === 'slave') {
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV2CommandDefinitions.setMasterInfo,
            {
                masterInfo: {
                    deviceId: props.topology.masterNodeId ?? props.deviceId,
                    serverAddress: [{address: props.topology.wsUrl}],
                    addedAt: Date.now() as any,
                },
            },
        ))
    }

    await runtime.dispatchCommand(createCommand(
        topologyRuntimeV2CommandDefinitions.refreshTopologyContext,
        {},
    ))

    await runtime.dispatchCommand(createCommand(
        tcpControlV2CommandDefinitions.bootstrapTcpControl,
        {
            deviceInfo: {
                id: props.deviceId,
                model: 'Mixc Retail Android RN84',
            },
        },
    ))

    if (props.topology?.ticketToken && props.topology.wsUrl) {
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV2CommandDefinitions.startTopologyConnection,
            {},
        ))
    }
}
