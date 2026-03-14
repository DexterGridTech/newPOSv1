import {Actor, LOG_TAGS, logger, storeEntry} from "@impos2/kernel-core-base";
import {
    getPathValuesFromUnitData,
    kernelCoreTerminalCommands,
    kernelCoreTerminalState
} from "@impos2/kernel-core-terminal";
import {kernelMixcProductUnitDataState} from "../../types/shared/moduleStateKey";
import {kernelMixcProductCommands} from "../commands";
import {moduleName} from "../../moduleName";

export class UnitDataActor extends Actor {
    unitDataChanged = Actor.defineCommandHandler(kernelCoreTerminalCommands.unitDataChanged,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "UnitDataActor"], 'unitDataChanged')
            if (command.payload.changeSet.group === kernelMixcProductUnitDataState.unitData_contract) {
                const unitData_contractState = storeEntry.getStateByKey(kernelMixcProductUnitDataState.unitData_contract)
                const terminalState = storeEntry.getStateByKey(kernelCoreTerminalState.terminal)
                const operatingEntity = terminalState.operatingEntity?.value!
                const model = terminalState.model?.value!
                const pathValues = getPathValuesFromUnitData(
                    operatingEntity, model, unitData_contractState
                )
                kernelMixcProductCommands.updateContracts(pathValues).executeInternally()
            }
            return {};
        });
}

