import {UserInfoState} from "./state";
import {unitDataGroups, UnitDataState} from "@impos2/kernel-base";
import {KernelUserStateMap} from "./stateNames";

declare module '@impos2/kernel-base' {
    // 扩展 RootState 接口
    export interface RootStateBase extends KernelUserStateMap {
    }

    export interface UnitDataGroupStates {
        something: UnitDataState
    }
}
unitDataGroups.add("something")