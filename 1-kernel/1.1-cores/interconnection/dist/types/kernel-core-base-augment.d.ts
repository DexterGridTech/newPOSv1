import { KernelCoreInterconnectionInstanceState, KernelCoreInterconnectionState } from "./moduleState";
import { SyncType } from "./shared/syncType";
declare module '@impos2/kernel-core-base' {
    interface RootState extends KernelCoreInterconnectionState, KernelCoreInterconnectionInstanceState {
    }
    interface ModuleSliceConfig<State = any> {
        syncType?: SyncType;
    }
}
//# sourceMappingURL=kernel-core-base-augment.d.ts.map