import {Actor, storeEntry} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionCommands} from "../commands";
import {instanceInfoActions} from "../slices/instanceInfo";
import {DisplayMode, InstanceMode} from "../../types";


export class InstanceInfoActor extends Actor {
    setInstanceToMaster = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setInstanceToMaster,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setInstanceMode(InstanceMode.MASTER))
            return {};
        })
    setInstanceToSlave = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setInstanceToSlave,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setInstanceMode(InstanceMode.SLAVE))
            return {};
        })
    setDisplayToPrimary = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setDisplayToPrimary,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setDisplayMode(DisplayMode.PRIMARY))
            return {};
        })
    setDisplayToSecondary = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setDisplayToSecondary,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setDisplayMode(DisplayMode.SECONDARY))
            return {};
        })
    setEnableSlave = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setEnableSlave,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.enableSlave(true))
            return {};
        })
    setDisableSlave = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setDisableSlave,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.enableSlave(false))
            return {};
        })
    setMasterInfo = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setMasterInfo,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setMasterInfo(command.payload))
            return {};
        })
    clearMasterInfo = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.clearMasterInfo,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setMasterInfo(null))
            return {};
        })
}