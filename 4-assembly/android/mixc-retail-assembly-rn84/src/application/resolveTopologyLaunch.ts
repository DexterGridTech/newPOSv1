import {nativeTopologyHost} from '../turbomodules'
import type {AppProps, AssemblyTopologyLaunchOptions} from '../types'

interface PreparedTopologyLaunch {
    masterNodeId?: string
    ticketToken?: string
    wsUrl?: string
    httpBaseUrl?: string
}

const isPreparedLaunchReady = (
    launch: PreparedTopologyLaunch,
): launch is Required<PreparedTopologyLaunch> => Boolean(
    launch.masterNodeId
        && launch.ticketToken
        && launch.wsUrl
        && launch.httpBaseUrl,
)

/**
 * 设计意图：
 * Android assembly 的主副屏都必须通过真实 loopback topology host 通讯。
 * 这里只补齐 native launch props，不做业务编排；业务层仍由 topology-runtime-v2 command/actor 接管。
 */
export const resolveAssemblyTopologyLaunch = async (
    props: AppProps,
): Promise<AssemblyTopologyLaunchOptions | undefined> => {
    if (props.topology?.ticketToken && props.topology.wsUrl) {
        return props.topology
    }
    if (props.displayCount <= 1) {
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
        ticketToken: prepared.ticketToken,
        wsUrl: prepared.wsUrl,
        httpBaseUrl: prepared.httpBaseUrl,
    }
}
