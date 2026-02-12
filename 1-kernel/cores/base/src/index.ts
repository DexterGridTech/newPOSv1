import {AppModule} from "./application/moduleType";
import {moduleName} from "./moduleName";
import {kernelCoreBaseSlice} from "./features/slices";
import {kernelCoreBaseActors} from "./features/actors";
import {kernelCoreBaseCommands} from "./features/commands";



export const kernelCoreModule:AppModule={
    name:moduleName,
    version:'0.0.1',
    dependencies: [],
    slices:kernelCoreBaseSlice,
    actors:kernelCoreBaseActors,
    commands:kernelCoreBaseCommands,
    epics:{},
    apis:{},
    errors:{},
    parameters:{}
}
