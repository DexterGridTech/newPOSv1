import {Actor, device, storeEntry} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionCommands} from "../commands";
import {instanceInfoActions} from "../slices/instanceInfo";
import {DisplayMode, InstanceMode} from "../../types";
import {powerStatusChangeListener} from "./initialize";
import {getInstanceMode, getWorkspace} from "../../foundations";
import {slaveStatusActions} from "../slices/slaveStatus";


export class InstanceInfoActor extends Actor {
    setInstanceToMaster = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setInstanceToMaster,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setInstanceMode(InstanceMode.MASTER))
            return {};
        })
    setInstanceToSlave = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setInstanceToSlave,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setInstanceMode(InstanceMode.SLAVE))
            const systemStatus = await device.getSystemStatus()
            powerStatusChangeListener({
                ...systemStatus.power,
                timestamp:Date.now()
            })
            return {};
        })
    setDisplayToPrimary = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setDisplayToPrimary,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setDisplayMode(DisplayMode.PRIMARY))
            if(getInstanceMode()===InstanceMode.SLAVE){
                const workspace=getWorkspace()
                storeEntry.dispatchAction(slaveStatusActions.setDisplayMode(DisplayMode.PRIMARY))
                storeEntry.dispatchAction(slaveStatusActions.setWorkspace(workspace))
            }
            return {};
        })
    setDisplayToSecondary = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setDisplayToSecondary,
        async (command): Promise<Record<string, any>> => {
            storeEntry.dispatchAction(instanceInfoActions.setDisplayMode(DisplayMode.SECONDARY))
            if(getInstanceMode()===InstanceMode.SLAVE){
                const workspace=getWorkspace()
                storeEntry.dispatchAction(slaveStatusActions.setDisplayMode(DisplayMode.PRIMARY))
                storeEntry.dispatchAction(slaveStatusActions.setWorkspace(workspace))
            }
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