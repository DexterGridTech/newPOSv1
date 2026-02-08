import React, {useCallback} from 'react';
import {useDeviceActivate} from '../../hooks';
import {ActivateForm} from '../components';
import {
    currentState,
    instanceInfoSlice,
    InstanceMode, LOG_TAGS, logger,
    RootState,
    ScreenMode,
    ScreenPartRegistration,
    terminalInfoSlice,
    KernelBaseStateNames,
} from "@impos2/kernel-base";
import {moduleName} from "../../moduleName";
import {useLifecycle} from "@impos2/ui-core-base-2";

export const ActivateDesktopScreen: React.FC = () => {
    useLifecycle({
        isVisible: true,
        componentName: 'ActivateDesktopScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <ActivateForm />
    );
};

export const activateDesktopScreenPart: ScreenPartRegistration = {
    name: 'activateDesktopScreen',
    title: '设备激活',
    description: '设备激活页面（桌面版）',
    partKey: 'activate',
    containerKey: 'screen.container.root',
    screenMode: [ScreenMode.DESKTOP],
    componentType: ActivateDesktopScreen,
    indexInContainer: 1,
    readyToEnter: () => {
        const state = currentState<RootState>()
        if (state[KernelBaseStateNames.instanceInfo].instance.instanceMode !== InstanceMode.MASTER) {
            return false;
        }
        if (state[KernelBaseStateNames.terminalInfo].terminal) {
            return false;
        }
        return true;
    }
}
