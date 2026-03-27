import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base";
import {
    kernelCoreInterconnectionState,
    InstanceInfoState,
    InstanceInterconnectionState,
} from "@impos2/kernel-core-interconnection";

type S = RootState & {
    [kernelCoreInterconnectionState.instanceInfo]: InstanceInfoState
    [kernelCoreInterconnectionState.instanceInterconnection]: InstanceInterconnectionState
}

export const useLocalServerStatus = () => {
    const connStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInterconnection]?.serverConnectionStatus
    );
    const masterInfo = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInfo]?.masterInfo
    );
    const slaveConnection = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInterconnection]?.master?.slaveConnection
    );
    return {connStatus, masterInfo, slaveConnection};
};
