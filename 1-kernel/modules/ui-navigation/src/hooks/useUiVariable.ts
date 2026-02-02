import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import {debounce} from 'lodash';
import {instanceInfoSlice, RootState} from "@impos2/kernel-base";
import {createSelector} from "@reduxjs/toolkit";
import {SetUiVariablesCommand} from "../features";
import {uiVariablesSlice} from "../features";
import {UIVariable, generateUiVariableKey} from "../core";


const selectUiVariablesState = (state: RootState) => state[uiVariablesSlice.name];

export const selectInstance = (state: RootState) => state[instanceInfoSlice.name].instance;

// 缓存 selector 实例，避免重复创建
const selectorCache = new Map<string, ReturnType<typeof createSelector>>();

export const selectUiVariable = <T = any>(state: RootState, key: string): T => {
    // 检查缓存中是否已有该 key 的 selector
    if (!selectorCache.has(key)) {
        // 创建新的 selector 并缓存
        const selector = createSelector(
            [selectUiVariablesState, selectInstance],
            (uiVariablesState, instance): T => {
                const fullKey = generateUiVariableKey(key, instance.instanceMode, instance.displayMode);
                return uiVariablesState[fullKey];
            }
        );
        selectorCache.set(key, selector);
    }

    // 使用缓存的 selector
    return selectorCache.get(key)!(state) as T;
};



/**
 * UI 变量单向绑定 Hook 配置选项
 */
export interface UseEditableUiVariableOptions<T> {
    /**
     * UI 变量的键名
     */
    variable: UIVariable<T>;
    /**
     * 防抖延迟时间(毫秒)
     * @default 300
     */
    debounceMs?: number;
}

/**
 * UI 变量单向绑定 Hook 返回值
 */
export interface UseEditableUiVariableResult<T> {
    /**
     * 当前显示的值(本地状态)
     */
    value: T;

    /**
     * 更新值的方法
     * - 立即更新本地显示状态
     * - 防抖更新 Redux state
     */
    setValue: (value: T) => void;

    /**
     * 重置为初始值
     */
    reset: () => void;
}

/**
 * UI 变量单向绑定 Hook
 *
 * 用于管理 Redux UI 变量的单向数据流,封装了完整的 Redux 访问逻辑:
 * - 自动从 Redux state 获取初始值
 * - 用户输入立即更新本地显示
 * - 防抖更新 Redux state
 * - 支持重置功能
 *
 * 数据流向:
 * ```
 * 初始化: Redux UI State → Local State (仅一次)
 * 用户输入: User Input → Local State (立即) → Redux UI State (防抖)
 * ```
 *
 * @example
 * ```typescript
 * // 基础用法 - 只需提供 key 和默认值
 * const { value, setValue } = useUiVariable({
 *   key: 'ui.device.active.activationCode',
 *   defaultValue: '',
 *   debounceMs: 300
 * });
 *
 * // 绑定到输入框
 * <Input value={value} onChangeText={setValue} />
 *
 * // 多字段表单
 * const username = useUiVariable({
 *   key: 'ui.form.username',
 *   defaultValue: ''
 * });
 *
 * const email = useUiVariable({
 *   key: 'ui.form.email',
 *   defaultValue: ''
 * });
 *
 * // 搜索框 - 使用更长防抖
 * const searchTerm = useUiVariable({
 *   key: 'ui.search.term',
 *   defaultValue: '',
 *   debounceMs: 500
 * });
 * ```
 *
 * @param options 配置选项
 * @returns 包含当前值和更新方法的对象
 */
export function useEditableUiVariable<T>({
                                             variable,
                                             debounceMs = 300,
                                         }: UseEditableUiVariableOptions<T>): UseEditableUiVariableResult<T> {

    // 从 Redux state 获取初始值
    const stateValue = useSelector((state: RootState) =>
        selectUiVariable<T>(state, variable.key)) || variable.defaultValue;

    // 获取初始值
    const getInitialValue = useCallback(() => {
        return stateValue;
    }, [stateValue]);

    // 本地状态:用于显示的值(单向绑定)
    const [localValue, setLocalValue] = useState<T>(getInitialValue);

    // 标记是否已初始化
    const isInitialized = useRef(false);

    // 保存初始值用于重置
    const savedInitialValue = useRef<T>(getInitialValue());

    // 首次加载时初始化值
    useEffect(() => {
        if (!isInitialized.current) {
            const initial = getInitialValue();
            setLocalValue(initial);
            savedInitialValue.current = initial;
            isInitialized.current = true;
        }
    }, [getInitialValue]);

    // 创建保存函数
    const onSave = useCallback((value: T) => {
        // 构造 UI 变量对象并保存
        new SetUiVariablesCommand({
            uiVariables: {
                [variable.key]: value
            }
        }).executeInternally();
    }, [variable.key]);

    // 使用 useMemo 创建防抖保存函数,避免每次渲染都创建新的防抖实例
    const debouncedSave = useMemo(
        () => debounce((value: T) => {
            onSave(value);
        }, debounceMs),
        [onSave, debounceMs]
    );

    /**
     * 更新值
     * - 立即更新本地显示状态
     * - 防抖更新外部状态
     */
    const setValue = useCallback(
        (value: T) => {
            setLocalValue(value); // 立即更新本地显示
            debouncedSave(value); // 防抖更新外部状态
        },
        [debouncedSave]
    );

    /**
     * 重置为初始值
     */
    const reset = useCallback(() => {
        setLocalValue(savedInitialValue.current);
        onSave(savedInitialValue.current);
    }, [onSave]);

    // 组件卸载时取消待执行的防抖调用
    useEffect(() => {
        return () => {
            debouncedSave.cancel();
        };
    }, [debouncedSave]);

    return {
        value: localValue,
        setValue,
        reset
    };
}

export function useUiVariable<T>(variable: UIVariable<T>): T {
    return useSelector((state: RootState) => selectUiVariable<T>(state, variable.key)) ?? variable.defaultValue;
}
