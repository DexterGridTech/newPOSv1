import {
    Actor,
    device,
    kernelCoreBaseCommands,
    LOG_TAGS,
    logger,
    PowerStatusChangeEvent,
    storeEntry
} from "@impos2/kernel-core-base";
import {moduleName} from "../../moduleName";
import {kernelCoreInterconnectionParameters} from "../../supports";
import {InstanceMode, kernelCoreInterconnectionState, Workspace} from "../../types";
import {kernelCoreInterconnectionCommands} from "../commands";
import {getInstanceMode, getStandalone, getWorkspace} from "../../foundations/accessory";

export class InitializeActor extends Actor {
    initialize = Actor.defineCommandHandler(kernelCoreBaseCommands.initialize,
        async (command): Promise<Record<string, any>> => {
            logger.log([moduleName, LOG_TAGS.Actor, "InitializeActor"], 'Initializing kernel core interconnection...')
            const instanceInfo = storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo)
            const isMaster = getInstanceMode() === InstanceMode.MASTER
            const shouldConnect = isMaster ? instanceInfo.enableSlave : !!instanceInfo.masterInfo
            logger.log([moduleName, LOG_TAGS.Actor, "InitializeActor"], `isMaster:${isMaster},Should connect: ${shouldConnect},masterInfo:${JSON.stringify(instanceInfo.masterInfo)}`)
            if (shouldConnect) {
                const delay = isMaster
                    ? kernelCoreInterconnectionParameters.masterServerBootstrapDelayAfterStartup.value
                    : kernelCoreInterconnectionParameters.slaveConnectDelayAfterStartup.value
                setTimeout(() => {
                    kernelCoreInterconnectionCommands.startConnection().executeInternally()
                }, delay)
            }
            device.addPowerStatusChangeListener(powerStatusChangeListener)
            const systemStatus = await device.getSystemStatus()
            powerStatusChangeListener({
                ...systemStatus.power,
                timestamp:Date.now()
            })

            return Promise.resolve({});
        });

}
const powerStatusChangeListener = (event: PowerStatusChangeEvent) => {
    logger.log([moduleName, LOG_TAGS.Actor, "powerStatusChangeListener"], 'Power status changed', event)
    const instanceMode=getInstanceMode()
    const standalone=getStandalone()
    const workspace=getWorkspace()
    if(standalone&&instanceMode===InstanceMode.SLAVE){
        if(event.powerConnected&&workspace===Workspace.BRANCH){
            kernelCoreInterconnectionCommands.setWorkspace(Workspace.MAIN).executeInternally()
        }else if (!event.powerConnected&&workspace===Workspace.MAIN){
            kernelCoreInterconnectionCommands.setWorkspace(Workspace.BRANCH).executeInternally()
        }
    }
}


