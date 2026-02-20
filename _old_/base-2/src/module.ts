import {kernalBaseModule, KernelModule} from "_old_/base";
import {moduleScreenParts} from "./ui";
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