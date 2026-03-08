import {useCallback, useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '@impos2/kernel-core-base';
import {
    InstanceMode,
    kernelCoreInterconnectionCommands,
    kernelCoreInterconnectionState,
    KernelCoreInterconnectionState,
    MasterInfo,
    ServerConnectionStatus,
    useRequestStatus,
} from '@impos2/kernel-core-interconnection';
import {baseTaskDefinitionKey, kernelCoreTaskCommands} from '@impos2/kernel-core-task';

type S = RootState & KernelCoreInterconnectionState

export const useSwitchInstanceMode = () => {
    const instanceInfo = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInfo]
    )
    const serverConnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreInterconnectionState.instanceInterconnection]?.serverConnectionStatus
    )

    const [scanRequestId, setScanRequestId] = useState<string | null>(null)
    const requestStatus = useRequestStatus(scanRequestId)

    useEffect(() => {
        if (!requestStatus) return

        // 只要不是 started 状态，就清空 scanRequestId
        if (requestStatus.status !== 'started') {
            if (requestStatus.status === 'complete') {
                console.log('=========>扫码结果', requestStatus.status, requestStatus.results)
                // 扫码结果在 context 中，不在 payload 中
                const barcode = requestStatus.results?.context?.root
                if (barcode && typeof barcode === 'object' && 'barcode' in barcode) {
                    const barcodeStr = barcode.barcode
                    if (barcodeStr) {
                        try {
                            const masterInfo: MasterInfo = JSON.parse(barcodeStr)
                            kernelCoreInterconnectionCommands.setMasterInfo(masterInfo).executeInternally()
                        } catch {
                            Alert.alert('错误', '二维码格式无效')
                        }
                    }
                }
            } else if (requestStatus.status === 'error') {
                Alert.alert('扫码失败', requestStatus.errors ? Object.values(requestStatus.errors)[0]?.message : '未知错误')
            }
            // 无论什么状态（complete/error/cancelled等），只要不是started，都清空
            setScanRequestId(null)
        }
    }, [requestStatus])

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
        if (scanRequestId) {
            console.log('扫码进行中，忽略重复调用')
            return
        }
        const requestId = `addMaster_${Date.now()}`
        setScanRequestId(requestId)
        kernelCoreTaskCommands.executeTask({
            taskKey: baseTaskDefinitionKey.singleReadBarcodeFromCamara,
            initContext: {}
        }).execute(requestId)
    }, [scanRequestId])

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
