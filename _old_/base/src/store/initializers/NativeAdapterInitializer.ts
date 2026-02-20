import {ApiManager, setNativeAdapter} from "../../core";
import {Workspace} from "../../types";
import {IStoreInitializer, StoreConfig} from "../types";

/**
 * Native Adapter 初始化器
 * 职责: 负责初始化 Native Adapter 和 API Server
 */
export class NativeAdapterInitializer implements IStoreInitializer {
    async initialize(config: StoreConfig): Promise<void> {
        if (config.nativeAdapter) {
            const workspaceInStorage = await config.nativeAdapter.storage.getItem<Workspace>("global", "workspace")
            if (workspaceInStorage) {
                config.workspace = workspaceInStorage
            }
            setNativeAdapter(config.workspace.selectedWorkspace, config.nativeAdapter);
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
