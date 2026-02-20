import React, {useCallback} from 'react';
import {ActivateForm} from '../components';
import {
    currentState,
    InstanceMode,
    KernelBaseStateNames,
    RootState,
    ScreenMode,
    ScreenPartRegistration,
} from "_old_/base";
import {useLifecycle} from "_old_/base-2";

export const ActivateDesktopScreen: React.FC = () => {
    useLifecycle({
        componentName: 'ActivateDesktopScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <ActivateForm/>
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
