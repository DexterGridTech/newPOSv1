import {nativeTopologyHost} from '../turbomodules'
import type {AppProps, AssemblyTopologyLaunchOptions} from '../types'

interface PreparedTopologyLaunch {
    masterNodeId?: string
    masterDeviceId?: string
    wsUrl?: string
    httpBaseUrl?: string
}

const isPreparedLaunchReady = (
    launch: PreparedTopologyLaunch,
): launch is Required<PreparedTopologyLaunch> => Boolean(
    launch.masterNodeId
        && launch.masterDeviceId
        && launch.wsUrl
        && launch.httpBaseUrl,
)

/**
 * 设计意图：
 * Android assembly 的主副屏都必须通过真实 loopback topology host 通讯。
 * 这里只补齐 native launch props，不做业务编排；业务层仍由 topology-runtime-v3 command/actor 接管。
 */
export const resolveAssemblyTopologyLaunch = async (
    props: AppProps,
): Promise<AssemblyTopologyLaunchOptions | undefined> => {
    if (props.displayCount <= 1) {
        return props.topology
    }

    const toMasterLaunch = (
        prepared: Required<PreparedTopologyLaunch>,
    ): AssemblyTopologyLaunchOptions => ({
        role: 'master',
        localNodeId: prepared.masterNodeId,
        masterNodeId: prepared.masterNodeId,
        masterDeviceId: prepared.masterDeviceId,
        wsUrl: prepared.wsUrl,
        httpBaseUrl: prepared.httpBaseUrl,
    })

    if (props.displayIndex === 0) {
        const prepared = await nativeTopologyHost.prepareLaunch(props.displayCount) as PreparedTopologyLaunch
        if (isPreparedLaunchReady(prepared)) {
            return toMasterLaunch(prepared)
        }
        return props.topology
    }

    if (props.topology?.wsUrl) {
        return props.topology
    }

    const prepared = await nativeTopologyHost.prepareLaunch(props.displayCount) as PreparedTopologyLaunch
    if (!isPreparedLaunchReady(prepared)) {
        return props.topology
    }

    const role = props.displayIndex === 0 ? 'master' : 'slave'
    return {
        role,
        localNodeId: role === 'master'
            ? prepared.masterNodeId
            : `${prepared.masterNodeId}:display-${props.displayIndex}`,
        masterNodeId: prepared.masterNodeId,
        masterDeviceId: prepared.masterDeviceId,
        wsUrl: prepared.wsUrl,
        httpBaseUrl: prepared.httpBaseUrl,
    }
}
