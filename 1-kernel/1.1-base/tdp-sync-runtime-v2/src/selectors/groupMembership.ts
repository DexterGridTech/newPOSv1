import type {RootState} from '@next/kernel-base-state-runtime'
import {selectTcpTerminalId} from '@next/kernel-base-tcp-control-runtime-v2'
import type {TdpTerminalGroupMembershipPayload} from '../types'
import {TDP_PROJECTION_STATE_KEY} from '../foundations/stateKeys'
import type {TdpProjectionState} from '../types'

export const selectTerminalGroupMembership = (state: RootState) => {
    const terminalId = selectTcpTerminalId(state)
    if (!terminalId) {
        return undefined
    }
    const projectionState = state[TDP_PROJECTION_STATE_KEY as keyof RootState] as TdpProjectionState | undefined
    const projection = Object.values(projectionState?.activeEntries ?? {}).find(item =>
        item.topic === 'terminal.group.membership'
        && item.scopeType === 'TERMINAL'
        && item.scopeId === terminalId
        && item.itemKey === terminalId,
    )
    return projection?.payload as TdpTerminalGroupMembershipPayload | undefined
}
