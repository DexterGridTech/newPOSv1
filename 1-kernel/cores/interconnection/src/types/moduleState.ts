/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {InstanceInfoState} from "./state/instanceInfo";
import {kernelCoreInterconnectionState} from "./shared/moduleStateKey";
import {MasterInterconnectionState} from "./state/masterInterconnection";
import {SlaveInterconnectionState} from "./state/slaveInterconnection";

export type KernelCoreInterconnectionStateMap = {
    [kernelCoreInterconnectionState.instanceInfo]:InstanceInfoState
    [kernelCoreInterconnectionState.masterConnection]:MasterInterconnectionState
    [kernelCoreInterconnectionState.slaveConnection]:SlaveInterconnectionState
}