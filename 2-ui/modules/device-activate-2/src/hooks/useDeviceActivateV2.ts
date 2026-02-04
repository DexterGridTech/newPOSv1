import {useCallback, useState} from 'react';
import {ActivateDeviceCommand, logger, useRequestStatus} from "@impos2/kernel-base";
import {useEditableUiVariable} from "@impos2/kernel-module-ui-navigation";
import {nanoid} from "@reduxjs/toolkit";
import {deviceActivateVariable} from "../variables";

// 设备激活Hook
export const useDeviceActivate = () => {
    const [requestId, setRequestId] = useState<string | null>(null);
    const newRequest = () => {
        const random = nanoid(8)
        setRequestId(random)
        return random
    }
    // 使用 UI 变量 Hook 管理激活码
    const {value: activationCode, setValue: setActivationCode} = useEditableUiVariable({
        variable: deviceActivateVariable.activationCode,
        debounceMs: 300
    });

    const activateStatus = useRequestStatus(requestId);

    // 使用 Command 状态查询 Hook
    // const activateStatus = useCommandStatus(BaseModuleCommandNames.ActivateDevice);

    /**
     * 处理激活码变更
     */
    const handleActivationCodeChange = useCallback(
        (value: string) => {
            setActivationCode(value);
            newRequest()
        },
        [setActivationCode]
    );

    // 提交激活
    const handleSubmit = useCallback(
        () => {
            // const model =
            //     createModelScreen(testModalScreenPart, nanoid(8), {
            //         name: 'test'
            //     })
            // new OpenModalCommand({model}).executeFromRequest(nanoid(8))

            // const alertInfo: AlertInfo = {
            //     title: "新闻",
            //     message: "新华社北京1月27日电（记者冯歆然）1月27日上午，国家主席习近\n平在北京人民大会堂会见来华进行正式访问的芬兰总理奥尔波。",
            //     confirmText: "确认",
            //     confirmCommandName: UiNavigationCommandNames.OpenModal,
            //     confirmCommandPayload: {model},
            //     cancelText: "取消",
            // }
            // const alertModel = createAlert(nanoid(8), alertInfo)
            // new AlertCommand({model: alertModel}).executeInternally()


            if (activateStatus?.status === 'started')
                return;
            logger.log('提交激活', activationCode);

            new ActivateDeviceCommand({activateCode: activationCode})
                .executeFromRequest(newRequest());
        },
        [activationCode, activateStatus]
    );

    return {
        // 状态
        activationCode,
        activateStatus,
        // 方法
        handleActivationCodeChange,
        handleSubmit,
    };
};
