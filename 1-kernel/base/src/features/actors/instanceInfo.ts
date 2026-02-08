import {AppError, CommandHandler, dispatchAction, IActor, storage, storeEntry} from "../../core";
import {
    AddSlaveCommand,
    NextDataVersionCommand,
    RegisterSlaveCommand,
    RemoveSlaveCommand,
    SetSlaveInfoCommand,
    SlaveAddedCommand,
    StartToConnectMasterServerCommand,
    UnregisterSlaveCommand,
    UpdateWorkSpaceCommand
} from "../commands";
import {instanceInfoActions} from "../slices";
import {RootState} from "../rootState";
import {InstanceErrors, ModifySlaveErrors} from "../errors";
import {KernelBaseStateNames} from "../../types/stateNames";
import {selectState} from "../../hooks/accessToState";


class InstanceInfoActor extends IActor {
    @CommandHandler(NextDataVersionCommand)
    private async handleNextDataVersion(command: NextDataVersionCommand) {
        try {
            await storage.setToNextDataVersion()
        } catch (e) {
            throw new AppError(InstanceErrors.STORAGE_PROCESS_ERROR, JSON.stringify(command.payload), command)
        }
    }

    @CommandHandler(UpdateWorkSpaceCommand)
    private async handleUpdateWorkSpaceCommand(command: UpdateWorkSpaceCommand) {
        try {
            await storage.setWorkspace(command.payload)
            dispatchAction(instanceInfoActions.setWorkspace(command.payload), command)
        } catch (e) {
            throw new AppError(InstanceErrors.STORAGE_PROCESS_ERROR, JSON.stringify(command.payload), command)
        }
    }

    @CommandHandler(AddSlaveCommand)
    private async handleAddSlave(command: AddSlaveCommand) {
        const instanceInfo = selectState('instanceInfo')
        if (instanceInfo.masterSlaves.hasOwnProperty(command.payload.name)) {
            throw new AppError(ModifySlaveErrors.SLAVE_EXISTED, command.payload.name, command)
        } else {
            dispatchAction(instanceInfoActions.addSlave(command.payload), command)
            new SlaveAddedCommand(command.payload).executeFromParent(command)
        }
    }

    @CommandHandler(RemoveSlaveCommand)
    private async handleRemoveSlave(command: RemoveSlaveCommand) {
        const instanceInfo = selectState('instanceInfo')
        if (!instanceInfo.masterSlaves.hasOwnProperty(command.payload.name)) {
            throw new AppError(ModifySlaveErrors.SLAVE_NOT_EXISTED, command.payload.name, command)
        } else if (instanceInfo.masterSlaves[command.payload.name].embedded) {
            throw new AppError(ModifySlaveErrors.SLAVE_IS_EMBEDDED, command.payload.name, command)
        } else {
            dispatchAction(instanceInfoActions.removeSlave(command.payload), command)
        }
    }

    @CommandHandler(RegisterSlaveCommand)
    private async handleRegisterSlave(command: RegisterSlaveCommand) {
        const masterSlaves = storeEntry.getMasterSlaves()
        if (!masterSlaves.hasOwnProperty(command.payload.name)) {
            throw new AppError(ModifySlaveErrors.SLAVE_NOT_EXISTED, command.payload.name, command)
        } else if (masterSlaves[command.payload.name].embedded) {
            throw new AppError(ModifySlaveErrors.SLAVE_IS_EMBEDDED, command.payload.name, command)
        } else if (masterSlaves[command.payload.name].deviceId) {
            throw new AppError(ModifySlaveErrors.SLAVE_IS_REGISTERED, command.payload.name, command)
        } else {
            dispatchAction(instanceInfoActions.registerSlave(command.payload), command)
        }
    }

    @CommandHandler(UnregisterSlaveCommand)
    private async handleUnregisterSlave(command: UnregisterSlaveCommand) {
        const masterSlaves = storeEntry.getMasterSlaves()
        if (!masterSlaves.hasOwnProperty(command.payload.name)) {
            throw new AppError(ModifySlaveErrors.SLAVE_NOT_EXISTED, command.payload.name, command)
        } else if (masterSlaves[command.payload.name].embedded) {
            throw new AppError(ModifySlaveErrors.SLAVE_IS_EMBEDDED, command.payload.name, command)
        } else {
            dispatchAction(instanceInfoActions.unregisterSlave(command.payload), command)
        }
    }

    @CommandHandler(SetSlaveInfoCommand)
    private async handleSetSlaveInfo(command: SetSlaveInfoCommand) {
        dispatchAction(instanceInfoActions.setSlaveConnectionInfo(command.payload), command)
        new StartToConnectMasterServerCommand().executeFromParent(command)
    }
}

export const instanceInfoActor = new InstanceInfoActor()