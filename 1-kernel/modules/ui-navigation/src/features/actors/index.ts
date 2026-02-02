import {IActor} from "@impos2/kernel-base";
import {navigatorActor} from "./navigator";
import {uiModelActor} from "./uiModels";

export * from './navigator';

export const uiNavigationModuleActors: IActor[] = [
    navigatorActor,
    uiModelActor
];
