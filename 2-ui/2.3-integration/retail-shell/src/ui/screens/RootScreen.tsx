import React, {useMemo, useState} from 'react'
import {View} from 'react-native'
import {useSelector} from 'react-redux'
import {selectTopologyDisplayMode, selectTopologyStandalone} from '@impos2/kernel-base-topology-runtime-v2'
import {
    InputRuntimeProvider,
    VirtualKeyboardOverlay,
} from '@impos2/ui-base-input-runtime'
import {
    AdminPopup,
    useAdminLauncher,
} from '@impos2/ui-base-admin-console'
import {UiRuntimeRootShell} from '@impos2/ui-base-runtime-react'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import type {RetailRootScreenProps} from '../../types'

export const RootScreen: React.FC<RetailRootScreenProps> = ({
    deviceId = 'UNKNOWN-DEVICE',
}) => {
    const displayMode = useSelector((state: RootState) => selectTopologyDisplayMode(state) ?? 'PRIMARY')
    const standalone = useSelector((state: RootState) => selectTopologyStandalone(state) ?? true)
    const [showAdminPopup, setShowAdminPopup] = useState(false)

    const launcherHandlers = useAdminLauncher({
        enabled: standalone,
        onTriggered: () => {
            setShowAdminPopup(true)
        },
    })

    const display = useMemo<'primary' | 'secondary'>(() => (
        displayMode === 'SECONDARY' ? 'secondary' : 'primary'
    ), [displayMode])

    return (
        <InputRuntimeProvider>
            <View
                testID="ui-integration-retail-shell:root"
                style={{flex: 1}}
                {...launcherHandlers}
            >
                <View
                    testID={`ui-integration-retail-shell:root:${display}`}
                    style={{flex: 1}}
                >
                    <UiRuntimeRootShell display={display} />
                </View>
                {showAdminPopup ? (
                    <AdminPopup
                        deviceId={deviceId}
                        onClose={() => setShowAdminPopup(false)}
                    />
                ) : null}
                <VirtualKeyboardOverlay />
            </View>
        </InputRuntimeProvider>
    )
}
