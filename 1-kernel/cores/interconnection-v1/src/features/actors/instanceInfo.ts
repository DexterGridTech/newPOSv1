import {Actor} from "@impos2/kernel-core-base-v1";
import {kernelCoreInterconnectionCommands} from "../commands";


export class InstanceInfoActor extends Actor {
    setInstanceToMaster = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setInstanceToMaster,
        async (command): Promise<Record<string, any>> => {

            return Promise.resolve({});
        })
    setInstanceToSlave = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setInstanceToSlave,
        async (command): Promise<Record<string, any>> => {

            return Promise.resolve({});
        })
    setDisplayToPrimary = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setDisplayToPrimary,
        async (command): Promise<Record<string, any>> => {

            return Promise.resolve({});
        })
    setDisplayToSecondary = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setDisplayToSecondary,
        async (command): Promise<Record<string, any>> => {

            return Promise.resolve({});
        })
    setEnableSlave = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setEnableSlave,
        async (command): Promise<Record<string, any>> => {

            return Promise.resolve({});
        })
    setDisableSlave = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setDisableSlave,
        async (command): Promise<Record<string, any>> => {

            return Promise.resolve({});
        })
    setMasterInfo = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.setMasterInfo,
        async (command): Promise<Record<string, any>> => {

            return Promise.resolve({});
        })
    clearMasterInfo = Actor.defineCommandHandler(kernelCoreInterconnectionCommands.clearMasterInfo,
        async (command): Promise<Record<string, any>> => {

            return Promise.resolve({});
        })
}