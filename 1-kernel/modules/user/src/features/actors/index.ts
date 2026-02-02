import {IActor} from "@impos2/kernel-base";
import {userInfoActor} from "./userInfo";

export * from './userInfo'

export const userModuleActors: IActor[] = [
    userInfoActor
]