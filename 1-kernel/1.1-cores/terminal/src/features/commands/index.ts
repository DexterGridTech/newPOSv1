import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {Unit} from "../../types/shared/unit";
import {UnitDataChangedSet} from "../../types";

export const kernelTerminalCommands = createModuleCommands(moduleName, {
    activateDevice: defineCommand<string>(),
    deactivateDevice: defineCommand<string>(),
    setOperatingEntity: defineCommand<Unit>(),
    setOperatingEntitySuccess: defineCommand<void>(),
    activateDeviceSuccess: defineCommand<void>(),
    deactivateDeviceSuccess: defineCommand<void>(),
    connectKernelWS: defineCommand<void>(),
    kernelWSConnected: defineCommand<void>(),
    kernelWSDisconnected: defineCommand<string>(),

    changeUnitData: defineCommand<{ changeSet: UnitDataChangedSet }>(),
    unitDataChanged: defineCommand<{ changeSet: UnitDataChangedSet }>(),

    sendStateToServer: defineCommand<void>(),
})

