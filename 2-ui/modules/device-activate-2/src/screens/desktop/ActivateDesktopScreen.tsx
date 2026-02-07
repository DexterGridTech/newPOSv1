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
import {moduleName} from "../../types";

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
    partKey: 'activate-v2',
    containerKey: 'screen.container.root',
    screenMode: [ScreenMode.DESKTOP],
    componentType: ActivateDesktopScreen,
    indexInContainer: 1,
    readyToEnter: () => {
        console.log('🟡 device-activate-2: readyToEnter 被调用');
        const state = currentState<RootState>()
        console.log('🟡 instanceMode:', state[instanceInfoSlice.name].instance.instanceMode);
        console.log('🟡 terminal:', state[terminalInfoSlice.name].terminal);

        if(state[instanceInfoSlice.name].instance.instanceMode !==InstanceMode.MASTER){
            logger.debug([moduleName, LOG_TAGS.System, 'ActivateDesktopScreen'], "非master设备，不能进入ActivateDesktopScreen");
            console.log('🟡 device-activate-2: readyToEnter 返回 false (非master)');
            return false;
        }
        if (state[terminalInfoSlice.name].terminal) {
            logger.debug([moduleName, LOG_TAGS.System, 'ActivateDesktopScreen'], "设备已激活，不能进入ActivateDesktopScreen");
            console.log('🟡 device-activate-2: readyToEnter 返回 false (已激活)');
            return false;
        }
        console.log('🟡 device-activate-2: readyToEnter 返回 true');
        return true;
    }
}
