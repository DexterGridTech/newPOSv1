import {UserInfoState} from "./state";
import {unitDataGroups, UnitDataState} from "_old_/base";
import {KernelUserStateMap} from "./stateNames";

declare module '_old_/base' {
    // 扩展 RootState 接口
    export interface RootStateBase extends KernelUserStateMap {
    }

    export interface UnitDataGroupStates {
        something: UnitDataState
    }
}
unitDataGroups.add("something")