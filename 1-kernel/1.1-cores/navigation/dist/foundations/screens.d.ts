import { ScreenPart, ScreenPartRegistration } from "@impos2/kernel-core-base";
import { ComponentType } from "react";
import { AlertInfo } from "../types";
/**
 * 注册 ScreenPart
 * @param registration ScreenPart 完整注册信息
 */
export declare function registerScreenPart(registration: ScreenPartRegistration): void;
export declare function getScreenPartComponentType(key: string): ComponentType<any> | undefined;
/**
 * 获取 ScreenPart 的 readyToEnter 方法
 */
export declare function getScreenPartReadyToEnter(key: string): (() => boolean) | undefined;
export declare function getFirstReadyScreenPartByContainerKey(containerKey: string, fromIndex: number): ScreenPart<any> | undefined;
/**
 * 获取指定 containerKey 下的所有 ScreenPartRegistration
 * @param containerKey 容器的 key
 * @returns 该容器下的所有 ScreenPartRegistration，按 indexInContainer 排序
 */
export declare function getScreenPartsByContainerKey(containerKey: string): ScreenPartRegistration[];
export declare const createModelScreen: <T>(screenPart: ScreenPart<any>, id: string, props: T) => {
    id: string;
    props: T;
    name: string;
    title: string;
    description: string;
    partKey: string;
    containerKey?: string | null;
    indexInContainer?: number | null;
};
export declare const defaultAlertPartKey = "alert";
export declare const createAlert: (id: string, props: AlertInfo) => {
    id: string;
    props: AlertInfo;
    partKey: string;
    name: string;
    title: string;
    description: string;
};
//# sourceMappingURL=screens.d.ts.map