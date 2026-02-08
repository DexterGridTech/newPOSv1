import {kernalBaseModule, KernelModule} from "@impos2/kernel-base";
import {moduleScreenParts} from "./basic";
import {moduleName} from './moduleName';

export const uiCoreBaseModule: KernelModule = {
    name: moduleName,
    reducers: {},
    epics: [],
    actors: [],
    screenParts: moduleScreenParts,
    dependencies:[
        kernalBaseModule
    ]
}