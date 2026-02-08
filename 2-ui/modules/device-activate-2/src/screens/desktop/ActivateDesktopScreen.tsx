import React from 'react';
// 直接从具体文件导入，避免循环依赖
import {useDeviceActivate} from '../../hooks/useDeviceActivateV2';
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
import {ScreenPartRegistration} from "@impos2/kernel-module-ui-navigation";
import {moduleName} from '../../moduleName';

// 诊断：打印导入的函数和组件
console.log('🔍 useDeviceActivate 函数:', useDeviceActivate);
const hookCode = useDeviceActivate.toString();
console.log('🔍 Hook 代码长度:', hookCode.length);
console.log('🔍 Hook 是否包含 ========$$$==========:', hookCode.includes('========$$$=========='));
console.log('🔍 ActivateForm 组件:', ActivateForm);

export const ActivateDesktopScreen: React.FC = () => {
    console.log('🟣 device-activate-2: ActivateDesktopScreen 组件被渲染');

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
    partKey: 'activate-v2',
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
