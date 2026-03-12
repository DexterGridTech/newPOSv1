import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {DisplayMode, Workspace} from "../shared";

export interface SlaveStatusState{
    displayMode?:ValueWithUpdatedAt<DisplayMode|null>
    workspace?:ValueWithUpdatedAt<Workspace|null>
    //后续可以补充要同步给master的SLAVE状态
}