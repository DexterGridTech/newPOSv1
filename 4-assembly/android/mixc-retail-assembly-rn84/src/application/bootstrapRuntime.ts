import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {topologyRuntimeV3CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v3'
import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {AppProps} from '../types'

export const bootstrapAssemblyRuntime = async (
    runtime: KernelRuntimeV2,
    props: AppProps,
): Promise<void> => {
    const isManagedSecondary = props.displayIndex > 0 && props.displayCount > 1

    if (props.displayIndex === 0 && props.displayCount > 1) {
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setEnableSlave,
            {enableSlave: true},
        ))
    }

    if (props.displayIndex > 0 && !isManagedSecondary) {
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setInstanceMode,
            {instanceMode: 'SLAVE'},
        ))
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {displayMode: 'SECONDARY'},
        ))
    }

    if (props.topology?.wsUrl && props.topology.role === 'slave') {
        await runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setMasterLocator,
            {
                masterLocator: {
                    masterNodeId: props.topology.masterNodeId,
                    masterDeviceId: props.topology.masterDeviceId,
                    serverAddress: [{address: props.topology.wsUrl}],
                    httpBaseUrl: props.topology.httpBaseUrl,
                    addedAt: Date.now() as any,
                },
            },
        ))
    }

    await runtime.dispatchCommand(createCommand(
        topologyRuntimeV3CommandDefinitions.refreshTopologyContext,
        {},
    ))

    if (!isManagedSecondary) {
        await runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.bootstrapTcpControl,
            {
                deviceInfo: {
                    id: props.deviceId,
                    model: 'Mixc Retail Android RN84',
                },
            },
        ))
    }

    if (props.topology?.wsUrl) {
        void Promise.resolve().then(async () => {
            await runtime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.startTopologyConnection,
                {},
            ))
        }).catch(() => {
            // 拓扑连接属于运行期长动作，不阻塞 initialize；失败由 topology-runtime 自己通过状态和日志暴露。
        })
    }
}
