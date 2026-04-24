import {releaseInfo as hostReleaseInfo} from '../generated/releaseInfo'
import type {HostRuntimeReleaseInfo} from './createApp'

let currentReleaseInfo: HostRuntimeReleaseInfo = hostReleaseInfo

export const setHostRuntimeReleaseInfo = (releaseInfo: HostRuntimeReleaseInfo | undefined): void => {
    currentReleaseInfo = releaseInfo ?? hostReleaseInfo
}

export const getHostRuntimeReleaseInfo = (): HostRuntimeReleaseInfo => currentReleaseInfo
