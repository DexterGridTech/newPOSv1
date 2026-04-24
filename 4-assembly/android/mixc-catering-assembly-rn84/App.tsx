import {createHostApp} from '@impos2/host-runtime-rn84'
import {
    RootScreen,
    createCateringBusinessModules,
    createModule as createCateringShellModule,
} from '@impos2/ui-integration-catering-shell'
import {releaseInfo} from './src/generated/releaseInfo'

export default createHostApp({
    RootScreen,
    createShellModule: createCateringShellModule,
    extraKernelModules: createCateringBusinessModules(),
    productConfig: {
        productId: 'mixc-catering',
        moduleName: 'assembly.android.mixc-catering-rn84',
        appRegistryName: 'MixcCateringAssemblyRN84',
        logTag: 'assembly.android.mixc-catering-rn84.boot',
        releaseInfo,
        adbSocketDebugEnabled: true,
    },
})
