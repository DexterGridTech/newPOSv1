import { DisplayMode, WorkspaceModuleSliceConfig } from '@impos2/kernel-core-interconnection';
import { UiVariablesState } from "../../types/state/uiVariables";
import { ScreenPart } from "@impos2/kernel-core-base";
export declare const uiVariablesActions: {
    openModal: (payload: {
        modal: ScreenPart<any>;
        displayMode: DisplayMode;
    }) => {
        payload: {
            modal: ScreenPart<any>;
            displayMode: DisplayMode;
        };
        type: string;
    };
    closeModal: (payload: {
        modalId: string;
        displayMode: DisplayMode;
    }) => {
        payload: {
            modalId: string;
            displayMode: DisplayMode;
        };
        type: string;
    };
    updateUiVariables: (payload: Record<string, any>) => {
        payload: Record<string, any>;
        type: string;
    };
    clearUiVariables: (payload: string[]) => {
        payload: string[];
        type: string;
    };
    batchUpdateState: (payload: any) => {
        payload: any;
        type: string;
    };
};
export declare const uiVariablesSliceConfig: WorkspaceModuleSliceConfig<UiVariablesState>;
//# sourceMappingURL=uiVariables.d.ts.map