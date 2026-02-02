import {userInfoSlice, UserInfoState} from "../features";
import {unitDataGroups, UnitDataState} from "@impos2/kernel-base";

declare module '@impos2/kernel-base' {
    // 扩展 RootState 接口
    export interface RootStateBase {
        [userInfoSlice.name]: UserInfoState
    }

    export interface UnitDataGroupStates {
        something: UnitDataState
    }
}
unitDataGroups.add("something")