import {useCallback, useEffect, useRef} from 'react';
import {Alert} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '@impos2/kernel-core-base';
import {
    kernelCoreInterconnectionCommands,
    KernelCoreInterconnectionState,
    kernelCoreInterconnectionState,
    InstanceMode,
    ServerConnectionStatus,
    MasterInfo,
} from '@impos2/kernel-core-interconnection';
import {TaskSystem, ProgressData, singleReadBarCodeFromCamera} from '@impos2/kernel-core-task';

type S = RootState & KernelCoreInterconnectionState

export const useSwitchInstanceMode = () => {
    const instanceInfo = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInfo]
    )
    const serverConnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInterconnection]?.serverConnectionStatus
    )

    const scanSubRef = useRef<{ unsubscribe: () => void } | null>(null)

    useEffect(() => {
        return () => { scanSubRef.current?.unsubscribe() }
    }, [])

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

    const handleAddMaster = useCallback(() => {
        scanSubRef.current?.unsubscribe()
        const taskSystem = TaskSystem.getInstance()
        taskSystem.registerTask(singleReadBarCodeFromCamera)
        const requestId = `addMaster_${Date.now()}`
        scanSubRef.current = taskSystem.task(singleReadBarCodeFromCamera.key).run(requestId, {}, false).subscribe({
            next: (data: ProgressData) => {
                if (data.type === 'NODE_COMPLETE' && data.payload?.barcode) {
                    try {
                        const masterInfo: MasterInfo = JSON.parse(data.payload.barcode)
                        kernelCoreInterconnectionCommands.setMasterInfo(masterInfo).executeInternally()
                    } catch {
                        Alert.alert('错误', '二维码格式无效')
                    }
                } else if (data.type === 'NODE_ERROR') {
                    taskSystem.cancel(requestId)
                    Alert.alert('扫码失败', data.error?.message ?? '未知错误')
                }
            },
            error: () => {},
            complete: () => { scanSubRef.current = null }
        })
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
        handleAddMaster
    }
}
