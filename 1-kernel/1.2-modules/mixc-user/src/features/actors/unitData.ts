import {Actor, storeEntry} from "@impos2/kernel-core-base";
import {
    getPathValuesFromUnitData,
    kernelCoreTerminalCommands,
    kernelCoreTerminalState
} from "@impos2/kernel-core-terminal";
import {kernelMixcUserUnitDataState} from "../../types/shared/moduleStateKey";
import {kernelMixcUserCommands} from "../commands";

export class UnitDataActor extends Actor {
    unitDataChanged = Actor.defineCommandHandler(kernelCoreTerminalCommands.unitDataChanged,
        async (command): Promise<Record<string, any>> => {
            if (command.payload.changeSet.group === kernelMixcUserUnitDataState.user) {
                const userState = storeEntry.getStateByKey(kernelMixcUserUnitDataState.user)
                const terminalState = storeEntry.getStateByKey(kernelCoreTerminalState.terminal)
                const operatingEntity = terminalState.operatingEntity?.value!
                const model = terminalState.model?.value!
                const pathValues = getPathValuesFromUnitData(
                    operatingEntity, model, userState
                )
                kernelMixcUserCommands.updateUserState(pathValues).executeInternally()
            }
            return {};
        });
}

