import {createHostApp} from '@next/host-runtime-rn84'
import {
    RootScreen,
    createCateringBusinessModules,
    createModule as createCateringShellModule,
} from '@next/ui-integration-catering-shell'
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
        activationCapability: {
            supportedProfileCodes: ['KERNEL_BASE_ANDROID_POS'],
            supportedTemplateCodes: ['KERNEL_BASE_ANDROID_POS_STANDARD'],
            supportedCapabilities: [
                'android.rn84',
                'product.mixc-catering',
                'profile.kernel-base-android-pos',
            ],
        },
    },
})
