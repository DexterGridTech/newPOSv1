import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState, NextDataVersionCommand, RestartApplicationCommand } from '@impos2/kernel-base';
import { storage } from '@impos2/kernel-base';

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
    const [isLoading, setIsLoading] = useState(false);

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
        loadDataVersion();
    }, [loadDataVersion]);

    // 清除数据处理函数
    const handleClearData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 执行 NextDataVersionCommand
            await new NextDataVersionCommand().executeInternally();

            // 重启应用
            new RestartApplicationCommand("数据已清除").executeInternally();
        } catch (error) {
            console.error('清除数据失败:', error);
            setIsLoading(false);
        }
    }, []);

    return {
        currentWorkspace,
        dataVersion,
        isLoading,
        handleClearData,
    };
};
