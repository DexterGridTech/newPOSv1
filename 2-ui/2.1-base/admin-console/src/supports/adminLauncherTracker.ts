import {adminLauncherDefaults} from '../foundations'

export interface AdminLauncherTrackerInput {
    requiredPresses?: number
    timeWindowMs?: number
    areaSize?: number
}

export const createAdminLauncherTracker = (
    input: AdminLauncherTrackerInput = {},
) => {
    let pressTimes: number[] = []

    return {
        recordPress(event: {pageX: number; pageY: number; now?: number}): boolean {
            const areaSize = input.areaSize ?? adminLauncherDefaults.areaSize
            if (event.pageX > areaSize || event.pageY > areaSize) {
                return false
            }

            const now = event.now ?? Date.now()
            const timeWindowMs = input.timeWindowMs ?? adminLauncherDefaults.timeWindowMs
            pressTimes = pressTimes.filter(time => now - time < timeWindowMs)
            pressTimes.push(now)

            const requiredPresses = input.requiredPresses ?? adminLauncherDefaults.requiredPresses
            if (pressTimes.length >= requiredPresses) {
                pressTimes = []
                return true
            }
            return false
        },
        reset() {
            pressTimes = []
        },
    }
}
