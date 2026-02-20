import {
    CommandHandler,
    customizedPathValue,
    dispatchAction,
    getPathValuesFromUnitData,
    IActor,
    logger,
    storeEntry
} from "../../core";
import {UnitDataChangedCommand} from "../commands";
import {RootState, UDG_SystemParameters} from "../rootState";
import {parameterCategory} from "../parameters";
import {systemParametersActions} from "../slices";
import {LOG_TAGS} from '../../types/core/logTags';
import {moduleName} from '../../moduleName';

class SystemParametersActor extends IActor {
    @CommandHandler(UnitDataChangedCommand)
    private async handleUnitDataChanged(command: UnitDataChangedCommand) {
        if (command.payload.changeSet.group == UDG_SystemParameters) {
            logger.log([moduleName, LOG_TAGS.Actor, "systemParameters"], `${UDG_SystemParameters} unit data changed`)
            const state = storeEntry.getState<RootState>()
            const udg_systemParameters = state[UDG_SystemParameters]
            const {operatingEntity, model} = state.terminalInfo
            const pathValues = getPathValuesFromUnitData(
                operatingEntity!, model!, udg_systemParameters
            )
            dispatchAction(systemParametersActions.setParameters(pathValues), command)
        }
    }
}


customizedPathValue.provider[parameterCategory] = (path: string) => {
    return storeEntry.getSystemParameter(path)
}

export const systemParametersActor = new SystemParametersActor()
