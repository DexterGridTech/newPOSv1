import {User} from "../shared";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";


export interface UserState {
    user?: ValueWithUpdatedAt<User>
}