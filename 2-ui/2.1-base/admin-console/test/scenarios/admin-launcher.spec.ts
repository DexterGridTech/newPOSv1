import {describe, expect, it, vi} from 'vitest'
import {adminLauncherDefaults, createAdminLauncherTracker} from '../../src'

describe('admin launcher', () => {
    it('triggers after repeated top-left presses', () => {
        const onTriggered = vi.fn()
        const tracker = createAdminLauncherTracker()

        for (let index = 0; index < adminLauncherDefaults.requiredPresses; index += 1) {
            if (tracker.recordPress({pageX: 10, pageY: 10, now: index + 1})) {
                onTriggered()
            }
        }

        expect(onTriggered).toHaveBeenCalledTimes(1)
    })
})
