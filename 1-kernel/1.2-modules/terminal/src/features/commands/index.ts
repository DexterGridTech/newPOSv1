import {createModuleCommands, defineCommand} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {Unit} from "../../types/shared/unit";

export const kernelTerminalCommands = createModuleCommands(moduleName, {
    activateDevice: defineCommand<string>(),
    deactivateDevice: defineCommand<void>(),
    setOperatingEntity: defineCommand<Unit>(),
    setOperatingEntitySuccess: defineCommand<void>(),
    activateDeviceSuccess: defineCommand<void>(),
    deActivateDeviceSuccess: defineCommand<void>()
})

