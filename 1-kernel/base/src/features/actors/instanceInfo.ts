import {AppError, CommandHandler, currentState, dispatchAction, IActor, storage} from "../../core";
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
import {instanceInfoActions, instanceInfoSlice} from "../slices";
import {RootState} from "../rootState";
import {InstanceErrors, ModifySlaveErrors} from "../errors";


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
        } catch (e) {
            throw new AppError(InstanceErrors.STORAGE_PROCESS_ERROR, JSON.stringify(command.payload), command)
        }
    }

    @CommandHandler(AddSlaveCommand)
    private async handleAddSlave(command: AddSlaveCommand) {
        const state = currentState<RootState>()
        if (state[instanceInfoSlice.name].masterSlaves.hasOwnProperty(command.payload.name)) {
            throw new AppError(ModifySlaveErrors.SLAVE_EXISTED, command.payload.name, command)
        } else {
            dispatchAction(instanceInfoActions.addSlave(command.payload), command)
            new SlaveAddedCommand(command.payload).executeFromParent(command)
        }
    }

    @CommandHandler(RemoveSlaveCommand)
    private async handleRemoveSlave(command: RemoveSlaveCommand) {
        const state = currentState<RootState>()
        if (!state[instanceInfoSlice.name].masterSlaves.hasOwnProperty(command.payload.name)) {
            throw new AppError(ModifySlaveErrors.SLAVE_NOT_EXISTED, command.payload.name, command)
        } else if (state[instanceInfoSlice.name].masterSlaves[command.payload.name].embedded) {
            throw new AppError(ModifySlaveErrors.SLAVE_IS_EMBEDDED, command.payload.name, command)
        } else {
            dispatchAction(instanceInfoActions.removeSlave(command.payload), command)
        }
    }

    @CommandHandler(RegisterSlaveCommand)
    private async handleRegisterSlave(command: RegisterSlaveCommand) {
        const state = currentState<RootState>()
        if (!state[instanceInfoSlice.name].masterSlaves.hasOwnProperty(command.payload.name)) {
            throw new AppError(ModifySlaveErrors.SLAVE_NOT_EXISTED, command.payload.name, command)
        } else if (state[instanceInfoSlice.name].masterSlaves[command.payload.name].embedded) {
            throw new AppError(ModifySlaveErrors.SLAVE_IS_EMBEDDED, command.payload.name, command)
        } else if (state[instanceInfoSlice.name].masterSlaves[command.payload.name].deviceId) {
            throw new AppError(ModifySlaveErrors.SLAVE_IS_REGISTERED, command.payload.name, command)
        } else {
            dispatchAction(instanceInfoActions.registerSlave(command.payload), command)
        }
    }

    @CommandHandler(UnregisterSlaveCommand)
    private async handleUnregisterSlave(command: UnregisterSlaveCommand) {
        const state = currentState<RootState>()
        if (!state[instanceInfoSlice.name].masterSlaves.hasOwnProperty(command.payload.name)) {
            throw new AppError(ModifySlaveErrors.SLAVE_NOT_EXISTED, command.payload.name, command)
        } else if (state[instanceInfoSlice.name].masterSlaves[command.payload.name].embedded) {
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