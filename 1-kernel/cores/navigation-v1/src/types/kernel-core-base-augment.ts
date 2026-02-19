
import {KernelCoreNavigationStateMap} from "./moduleState";
import {ScreenPartRegistration} from "./foundations/screen";

declare module '@impos2/kernel-core-base-v1' {
    // 扩展 RootState 接口

    export interface RootStateBase extends KernelCoreNavigationStateMap {
    }
    export interface AppModule {
        screenParts?: Record<string, ScreenPartRegistration>
    }
}