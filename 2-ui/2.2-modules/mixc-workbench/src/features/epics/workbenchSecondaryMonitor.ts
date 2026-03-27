import {Epic} from 'redux-observable';
import {distinctUntilChanged, filter, ignoreElements, map, tap} from 'rxjs/operators';
import {RootState, ValueWithUpdatedAt} from '@impos2/kernel-core-base';
import {PayloadAction} from '@reduxjs/toolkit';
import {InstanceInfoState, InstanceMode, kernelCoreInterconnectionState} from '@impos2/kernel-core-interconnection';
import {
    kernelCoreNavigationCommands,
    kernelCoreNavigationWorkspaceState,
    UiVariablesState,
} from '@impos2/kernel-core-navigation';
import {mpWorkbenchDesktopScreenPart, spWorkbenchDesktopScreenPart} from '../../ui/screens/WorkbenchDesktopScreen';

// 扩展 RootState 类型
type ExtendedRootState = RootState & {
    [kernelCoreInterconnectionState.instanceInfo]: InstanceInfoState;
    [key: string]: any; // 用于动态访问 uiVariables
};

// 容器值的类型
interface ContainerValue {
    partKey?: string;
    [key: string]: any;
}

/**
 * 监听副屏工作台状态的 Epic
 *
 * 性能优化：
 * 1. 使用 distinctUntilChanged 避免重复触发
 * 2. 提前过滤不符合条件的状态
 * 3. 直接从 state$ 读取，避免不必要的订阅
 */
export const workbenchSecondaryMonitorEpic: Epic<PayloadAction, PayloadAction, RootState> = (action$, state$) => {
    return state$.pipe(
        // 获取 primary.root.container 的值
        map(() => {
            const state = state$.value as ExtendedRootState;

            // 提前过滤：只有当 instanceMode 为 SLAVE 且 displayMode 为 primary 时才继续
            const instanceInfo = state[kernelCoreInterconnectionState.instanceInfo];
            if (instanceInfo?.instanceMode !== InstanceMode.SLAVE || instanceInfo?.displayMode !== 'primary') {
                return null;
            }

            const uiVariablesKey = `${kernelCoreNavigationWorkspaceState.uiVariables}.main`;
            const uiVariables = state[uiVariablesKey] as UiVariablesState | undefined;
            const containerValueWithUpdatedAt = uiVariables?.['primary.root.container'] as ValueWithUpdatedAt<ContainerValue> | undefined;
            return containerValueWithUpdatedAt?.value;
        }),

        // 过滤掉 null 值
        filter((containerValue): containerValue is ContainerValue => containerValue !== null),

        // 使用 distinctUntilChanged 避免相同值重复触发
        // 比较 partKey 是否变化
        distinctUntilChanged((prev, curr) => prev?.partKey === curr?.partKey),

        // 过滤：只有当 partKey 匹配时才触发
        filter((containerValue) => {
            return containerValue?.partKey === mpWorkbenchDesktopScreenPart.partKey;
        }),

        // 副屏显示（副作用）
        tap(() => {
            kernelCoreNavigationCommands.navigateTo({target: spWorkbenchDesktopScreenPart}).executeInternally();
        }),

        // 不发出任何 action
        ignoreElements()
    );
};
