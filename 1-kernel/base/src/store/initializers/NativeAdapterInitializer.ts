import { ApiManager, setNativeAdapter } from "../../core";
import { IStoreInitializer, StoreConfig } from "../types";

/**
 * Native Adapter 初始化器
 * 职责: 负责初始化 Native Adapter 和 API Server
 */
export class NativeAdapterInitializer implements IStoreInitializer {
    initialize(config: StoreConfig): void {
        if (config.nativeAdapter) {
            setNativeAdapter(config.nativeAdapter);
        }

        const selectedWorkspace = config.workspace.workspaces.find(
            it => it.workspaceName === config.workspace.selectedWorkspace
        );

        if (selectedWorkspace) {
            selectedWorkspace.apiServerAddresses.forEach(address =>
                ApiManager.getInstance().initApiServerAddress(address)
            );
        }
    }
}
