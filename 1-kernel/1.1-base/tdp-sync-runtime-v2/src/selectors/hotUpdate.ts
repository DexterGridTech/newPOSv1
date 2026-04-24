import type {RootState} from '@next/kernel-base-state-runtime'
import type {HotUpdateState} from '../types'
import {TDP_HOT_UPDATE_STATE_KEY} from '../foundations/stateKeys'

export const selectTdpHotUpdateState = (state: RootState) =>
    state[TDP_HOT_UPDATE_STATE_KEY as keyof RootState] as HotUpdateState | undefined

export const selectTdpHotUpdateDesired = (state: RootState) =>
    selectTdpHotUpdateState(state)?.desired

export const selectTdpHotUpdateCandidate = (state: RootState) =>
    selectTdpHotUpdateState(state)?.candidate

export const selectTdpHotUpdateReady = (state: RootState) =>
    selectTdpHotUpdateState(state)?.ready

export const selectTdpHotUpdateCurrent = (state: RootState) =>
    selectTdpHotUpdateState(state)?.current

export const selectTdpHotUpdateRestartIntent = (state: RootState) =>
    selectTdpHotUpdateState(state)?.restartIntent

export const selectTdpHotUpdateLastUserOperationAt = (state: RootState) =>
    selectTdpHotUpdateState(state)?.lastUserOperationAt
