import {useCallback, useEffect} from 'react';
import {logger, LOG_TAGS} from "@impos2/kernel-base";
import {useEditableUiVariable} from "@impos2/kernel-module-ui-navigation";
import {systemAdminVariable} from "../variables";

const moduleName = 'ui-system-admin';

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
export interface UseSystemAdminConfig {
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
 * 系统管理 Hook
 *
 * 职责：
 * 1. 管理系统管理相关的状态
 * 2. 处理系统管理相关的业务逻辑
 * 3. 监听组件生命周期
 * 4. 提供详细的日志记录
 */
export const useSystemAdmin = (config?: UseSystemAdminConfig) => {
    const {
        lifecycle,
        enableLifecycleLog = true
    } = config || {};

    // 使用 UI 变量 Hook 管理管理员名称
    const {value: adminName, setValue: setAdminName} = useEditableUiVariable({
        variable: systemAdminVariable.adminName,
        debounceMs: 300
    });

    /**
     * 组件生命周期管理
     */
    useEffect(() => {
        // 组件挂载
        if (enableLifecycleLog) {
            logger.log([moduleName, LOG_TAGS.System, 'useSystemAdmin'], 'Component mounted', {
                timestamp: new Date().toISOString(),
                adminName: adminName || 'empty'
            });
        }

        // 执行用户提供的挂载回调
        if (lifecycle?.onMount) {
            try {
                lifecycle.onMount();
            } catch (error) {
                logger.error([moduleName, LOG_TAGS.System, 'useSystemAdmin'], 'Error in onMount callback', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        // 组件卸载
        return () => {
            if (enableLifecycleLog) {
                logger.log([moduleName, LOG_TAGS.System, 'useSystemAdmin'], 'Component unmounting', {
                    timestamp: new Date().toISOString(),
                    finalAdminName: adminName || 'empty'
                });
            }

            // 执行用户提供的卸载回调
            if (lifecycle?.onUnmount) {
                try {
                    lifecycle.onUnmount();
                } catch (error) {
                    logger.error([moduleName, LOG_TAGS.System, 'useSystemAdmin'], 'Error in onUnmount callback', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            if (enableLifecycleLog) {
                logger.log([moduleName, LOG_TAGS.System, 'useSystemAdmin'], 'Component unmounted and resources released');
            }
        };
    }, []); // 空依赖数组，只在挂载和卸载时执行

    /**
     * 处理管理员名称变更
     */
    const handleAdminNameChange = useCallback(
        (value: string) => {
            setAdminName(value);
        },
        [setAdminName]
    );

    return {
        // 状态
        adminName,
        // 方法
        handleAdminNameChange,
    };
};
