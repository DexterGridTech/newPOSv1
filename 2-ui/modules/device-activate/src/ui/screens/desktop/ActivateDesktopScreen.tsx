import React from 'react';
import {useDeviceActivate} from '../../../hooks';
import {ActivateForm} from '../../components';
import {
    currentState,
    instanceInfoSlice,
    InstanceMode,
    logger,
    LOG_TAGS,
    RootState,
    ScreenMode,
    terminalInfoSlice,
} from "@impos2/kernel-base";
import {ScreenPartRegistration} from "@impos2/kernel-base";
import {moduleName} from '../../../moduleName';

export const ActivateDesktopScreen: React.FC = () => {
    console.log('🟣 device-activate: ActivateDesktopScreen 组件被渲染');

    const {
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit,
    } = useDeviceActivate();

    return (
        <ActivateForm
            activationCode={activationCode}
            activateStatus={activateStatus}
            onActivationCodeChange={handleActivationCodeChange}
            onSubmit={handleSubmit}
        />
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
        if(state[instanceInfoSlice.name].instance.instanceMode !==InstanceMode.MASTER){
            return false;
        }
        if (state[terminalInfoSlice.name].terminal) {
            return false;
        }
        return true;
    }
}
