import {useCallback, useEffect, useState} from 'react';
import {useRequestStatus, RootState} from "_old_/base";
import {nanoid} from "@reduxjs/toolkit";
import {UpdateWorkSpaceCommand, RestartApplicationCommand, Workspace} from "_old_/base";
import {useSelector} from "react-redux";

export const useSetupWorkspace = () => {
    const [requestId, setRequestId] = useState<string | null>(null);
    const newRequest = () => {
        const random = nanoid(8);
        setRequestId(random);
        return random;
    };

    // 使用 useSelector 订阅 Redux state 变化
    const currentWorkspace = useSelector((state: RootState) => state.instanceInfo.workspace);

    // 本地选中的工作空间
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>(
        currentWorkspace.selectedWorkspace
    );

    const updateStatus = useRequestStatus(requestId);

    /**
     * 监听更新状态，完成后重启应用
     */
    useEffect(() => {
        if (updateStatus?.status === 'complete') {
            // 发送重启命令
            new RestartApplicationCommand("工作空间已切换").executeInternally();
        }
    }, [updateStatus?.status]);

    /**
     * 判断是否有变化
     */
    const hasChanges = selectedWorkspace !== currentWorkspace.selectedWorkspace;

    /**
     * 处理工作空间选择变化
     */
    const handleWorkspaceChange = useCallback((workspaceName: string) => {
        setSelectedWorkspace(workspaceName);
    }, []);

    /**
     * 提交更新
     */
    const handleSubmit = useCallback(() => {
        if (!hasChanges || updateStatus?.status === 'started') {
            return;
        }

        const updatedWorkspace: Workspace = {
            ...currentWorkspace,
            selectedWorkspace: selectedWorkspace
        };

        new UpdateWorkSpaceCommand(updatedWorkspace)
            .executeFromRequest(newRequest());
    }, [hasChanges, updateStatus, currentWorkspace, selectedWorkspace]);

    return {
        // 状态
        currentWorkspace,
        selectedWorkspace,
        hasChanges,
        updateStatus,
        // 方法
        handleWorkspaceChange,
        handleSubmit,
    };
};
