import {useCallback, useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {AlertCommand, BaseModuleCommandNames, createAlert, RootState, storage} from '@impos2/kernel-base';
import {nanoid} from "@reduxjs/toolkit";

/**
 * 清除数据版本 Hook
 *
 * 职责：
 * 1. 获取当前工作空间名称
 * 2. 获取当前数据版本
 * 3. 处理清除数据逻辑
 * 4. 清除后自动重启应用
 */
export const useClearDataVersion = () => {
    const [dataVersion, setDataVersion] = useState<number>(0);

    // 从 Redux 获取当前工作空间
    const currentWorkspace = useSelector((state: RootState) =>
        state.instanceInfo.workspace.selectedWorkspace
    );

    // 加载数据版本
    const loadDataVersion = useCallback(async () => {
        try {
            const version = await storage.getDataVersion();
            setDataVersion(version);
        } catch (error) {
            console.error('加载数据版本失败:', error);
        }
    }, []);

    // 组件挂载时加载数据版本
    useEffect(() => {
        loadDataVersion().then();
    }, [loadDataVersion]);

    // 清除数据处理函数
    const handleClearData = useCallback(async () => {

        const alertModel = createAlert(nanoid(8), {
            title: "危险",
            message: "清除后数据将无法恢复",
            confirmText: "确认",
            confirmCommandName: BaseModuleCommandNames.NextDataVersion,
            confirmCommandPayload: {},
            cancelText: "取消",
        })
        new AlertCommand({model: alertModel}).executeFromRequest(nanoid(8));

    }, []);

    return {
        currentWorkspace,
        dataVersion,
        handleClearData,
    };
};
