import {IActor} from "../core";
import {deviceStatusActor} from "./actors/deviceStatus";
import {instanceInfoActor} from "./actors/instanceInfo";
import {masterServerStatusActor} from "./actors/masterServerStatus";
import {slaveStatusActor} from "./actors/slaveStatus";
import {terminalInfoActor} from "./actors/terminalInfo";
import {systemParametersActor} from "./actors/systemParameters";
import {terminalStatusActor} from "./actors/terminalStatus";
import {unitDataActor} from "./actors/unitData";

export const baseModuleActors:IActor[] = [
    deviceStatusActor,
    instanceInfoActor,
    masterServerStatusActor,
    slaveStatusActor,
    systemParametersActor,
    terminalInfoActor,
    terminalStatusActor,
    unitDataActor
]
