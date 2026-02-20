import {IActor} from "_old_/base";
import {userInfoActor} from "./userInfo";

export * from './userInfo'

export const userModuleActors: IActor[] = [
    userInfoActor
]