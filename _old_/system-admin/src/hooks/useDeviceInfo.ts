import {useCallback, useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {AlertCommand, BaseModuleCommandNames, createAlert, RootState, storage} from '_old_/base';
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
export const useDeviceInfo = () => {

    // 从 Redux 获取当前工作空间
    const deviceInfo = useSelector((state: RootState) =>
        state.deviceStatus.deviceInfo
    );

    return {
        deviceInfo
    };
};
