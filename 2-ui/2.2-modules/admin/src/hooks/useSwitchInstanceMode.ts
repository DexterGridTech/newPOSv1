import {useCallback} from 'react';
import {useSelector} from 'react-redux';
import {RootState} from '@impos2/kernel-core-base';
import {
    kernelCoreInterconnectionCommands,
    KernelCoreInterconnectionState,
    kernelCoreInterconnectionState,
    InstanceMode,
    ServerConnectionStatus,
} from '@impos2/kernel-core-interconnection';

type S = RootState & KernelCoreInterconnectionState

export const useSwitchInstanceMode = () => {
    const instanceInfo = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInfo]
    )
    const serverConnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInterconnection]?.serverConnectionStatus
    )

    const handleSetMaster = useCallback(() => {
        kernelCoreInterconnectionCommands.setInstanceToMaster().executeInternally()
    }, [])

    const handleSetSlave = useCallback(() => {
        kernelCoreInterconnectionCommands.setInstanceToSlave().executeInternally()
    }, [])

    const handleEnableSlave = useCallback(() => {
        kernelCoreInterconnectionCommands.setEnableSlave().executeInternally()
    }, [])

    const handleStartConnection = useCallback(() => {
        kernelCoreInterconnectionCommands.startConnection().executeInternally()
    }, [])

    const instanceMode = instanceInfo?.instanceMode
    const isMaster = instanceMode === InstanceMode.MASTER
    const isSlave = instanceMode === InstanceMode.SLAVE
    const isServerConnected = serverConnectionStatus === ServerConnectionStatus.CONNECTED
    const isServerConnecting = serverConnectionStatus === ServerConnectionStatus.CONNECTING

    return {
        instanceMode,
        standalone: instanceInfo?.standalone ?? false,
        enableSlave: instanceInfo?.enableSlave ?? false,
        masterInfo: instanceInfo?.masterInfo,
        isMaster,
        isSlave,
        isServerConnected,
        isServerConnecting,
        handleSetMaster,
        handleSetSlave,
        handleEnableSlave,
        handleStartConnection,
    }
}
