import type {KernelRuntimeModuleV2} from '@next/kernel-base-runtime-shell-v2'
import {tdpHotUpdateSliceDescriptor} from '../../src/features/slices/tdpHotUpdate'

export const createHotUpdateReadModelModule = (): KernelRuntimeModuleV2 => ({
    moduleName: 'kernel.base.tdp-sync-runtime-v2.test.hot-update-read-model',
    packageVersion: '0.0.1',
    stateSlices: [tdpHotUpdateSliceDescriptor],
})
