import {describe, expect, it} from 'vitest'
import {decideAssemblyTopologyHostLifecycle} from '../../src/application/topology'

describe('assembly topology host lifecycle', () => {
    it('starts host only for single-screen primary master with enableSlave=true', () => {
        expect(decideAssemblyTopologyHostLifecycle({
            displayCount: 1,
            displayIndex: 0,
            instanceMode: 'MASTER',
            enableSlave: true,
        })).toEqual({
            shouldRun: true,
            reason: 'master-primary-enable-slave',
        })
    })

    it('keeps host stopped for master until enableSlave is enabled', () => {
        expect(decideAssemblyTopologyHostLifecycle({
            displayCount: 1,
            displayIndex: 0,
            instanceMode: 'MASTER',
            enableSlave: false,
        })).toEqual({
            shouldRun: false,
            reason: 'not-master-or-single-primary-host',
        })
    })

    it('does not start host for slave or managed secondary contexts', () => {
        expect(decideAssemblyTopologyHostLifecycle({
            displayCount: 1,
            displayIndex: 0,
            instanceMode: 'SLAVE',
            enableSlave: true,
        }).shouldRun).toBe(false)

        expect(decideAssemblyTopologyHostLifecycle({
            displayCount: 2,
            displayIndex: 1,
            instanceMode: 'MASTER',
            enableSlave: true,
        }).shouldRun).toBe(false)
    })

    it('does not start host for two-screen primary because topology host is launched by native coordinator', () => {
        expect(decideAssemblyTopologyHostLifecycle({
            displayCount: 2,
            displayIndex: 0,
            instanceMode: 'MASTER',
            enableSlave: true,
        })).toEqual({
            shouldRun: false,
            reason: 'not-master-or-single-primary-host',
        })
    })
})
