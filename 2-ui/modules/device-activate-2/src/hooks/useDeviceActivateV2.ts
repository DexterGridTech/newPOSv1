import {useCallback, useEffect, useState} from 'react';
import {ActivateDeviceCommand, logger, LOG_TAGS, useRequestStatus} from "@impos2/kernel-base";
import {
    AlertCommand,
    AlertInfo, createAlert,
    createModelScreen,
    OpenModalCommand, UiNavigationCommandNames,
    useEditableUiVariable
} from "@impos2/kernel-module-ui-navigation";
import {nanoid} from "@reduxjs/toolkit";
import {deviceActivateVariable} from "../variables";
import {testModalScreenPart} from "../modals";
import {moduleName} from "../types";

/**
 * 生命周期回调接口
 */
export interface LifecycleCallbacks {
    /**
     * 组件挂载时的回调
     */
    onMount?: () => void;
    /**
     * 组件卸载时的回调
     */
    onUnmount?: () => void;
}

/**
 * Hook 配置接口
 */
export interface UseDeviceActivateConfig {
    /**
     * 生命周期回调
     */
    lifecycle?: LifecycleCallbacks;
    /**
     * 是否启用生命周期日志
     * @default true
     */
    enableLifecycleLog?: boolean;
}

/**
 * 设备激活Hook
 *
 * 职责：
 * 1. 管理激活码状态
 * 2. 处理激活请求
 * 3. 监听组件生命周期
 * 4. 提供详细的日志记录
 */
export const useDeviceActivate = (config?: UseDeviceActivateConfig) => {
    const {
        lifecycle,
        enableLifecycleLog = true
    } = config || {};

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

    /**
     * 组件生命周期管理
     */
    useEffect(() => {
        // 组件挂载
        if (enableLifecycleLog) {
            logger.log([moduleName, LOG_TAGS.System, 'useDeviceActivate'], 'Component mounted', {
                timestamp: new Date().toISOString(),
                activationCode: activationCode || 'empty'
            });
        }

        // 执行用户提供的挂载回调
        if (lifecycle?.onMount) {
            try {
                lifecycle.onMount();
            } catch (error) {
                logger.error([moduleName, LOG_TAGS.System, 'useDeviceActivate'], 'Error in onMount callback', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        // 组件卸载
        return () => {
            if (enableLifecycleLog) {
                logger.log([moduleName, LOG_TAGS.System, 'useDeviceActivate'], 'Component unmounting', {
                    timestamp: new Date().toISOString(),
                    finalActivationCode: activationCode || 'empty',
                    finalStatus: activateStatus?.status || 'unknown'
                });
            }

            // 执行用户提供的卸载回调
            if (lifecycle?.onUnmount) {
                try {
                    lifecycle.onUnmount();
                } catch (error) {
                    logger.error([moduleName, LOG_TAGS.System, 'useDeviceActivate'], 'Error in onUnmount callback', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            if (enableLifecycleLog) {
                logger.log([moduleName, LOG_TAGS.System, 'useDeviceActivate'], 'Component unmounted and resources released');
            }
        };
    }, []); // 空依赖数组，只在挂载和卸载时执行

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
            // 创建 testModal 的 model（不立即打开）
            const model =
                createModelScreen(testModalScreenPart, nanoid(8), {
                    name: 'test'
                })

            // 创建 Alert，确认后才打开 testModal
            const alertInfo: AlertInfo = {
                title: "新闻",
                message: "新华社北京1月27日电（记者冯歆然）1月27日上午，国家主席习近\\n平在北京人民大会堂会见来华进行正式访问的芬兰总理奥尔波。",
                confirmText: "确认",
                confirmCommandName: UiNavigationCommandNames.OpenModal,
                confirmCommandPayload: {model},
                cancelText: "取消",
            }
            const alertModel = createAlert(nanoid(8), alertInfo)
            new AlertCommand({model: alertModel}).executeInternally()


            // if (activateStatus?.status === 'started')
            //     return;
            // logger.log('提交激活', activationCode);

            // new ActivateDeviceCommand({activateCode: activationCode})
            //     .executeFromRequest(newRequest());
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
