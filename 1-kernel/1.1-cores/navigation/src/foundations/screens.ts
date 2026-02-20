import {getScreenMode, ScreenMode, ScreenPart, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {ComponentType} from "react";
import {AlertInfo} from "../types";

/**
 * ScreenPart 注册信息存储
 */
// 按 category 分类存储的注册表
const screenRegistryMap: Record<ScreenMode, Map<string, ScreenPartRegistration>> = {
    [ScreenMode.MOBILE]: new Map<string, ScreenPartRegistration>(),
    [ScreenMode.DESKTOP]: new Map<string, ScreenPartRegistration>()
}

/**
 * 注册 ScreenPart
 * @param registration ScreenPart 完整注册信息
 */
export function registerScreenPart(registration: ScreenPartRegistration) {
    registration.screenMode.forEach(mode => {
        const registry = screenRegistryMap[mode]
        if (registry.has(registration.partKey)) {
            throw new Error(`Screen part with key '${registration.partKey}' is already registered in ${registration.screenMode}`)
        }
        registry.set(registration.partKey, registration)
    })
}
export function getScreenPartComponentType(key: string): ComponentType<any> | undefined {
    const screenMode = getScreenMode()
    return screenRegistryMap[screenMode].get(key)?.componentType
}



/**
 * 获取 ScreenPart 的 readyToEnter 方法
 */
export function getScreenPartReadyToEnter(key: string): (() => boolean) | undefined {
    const screenMode = getScreenMode()
    return screenRegistryMap[screenMode].get(key)?.readyToEnter
}

export function getFirstReadyScreenPartByContainerKey(containerKey: string, fromIndex: number): ScreenPart<any> | undefined {
    const screenMode = getScreenMode()
    const registration = Array.from(screenRegistryMap[screenMode].values())
        .filter(part =>
            part.containerKey === containerKey &&
            part.indexInContainer != null &&
            part.indexInContainer > fromIndex
        )
        .sort((a, b) => (a.indexInContainer ?? 0) - (b.indexInContainer ?? 0))
        .find(part => part.readyToEnter?.() ?? true)

    if (!registration) {
        return undefined
    }

    // 将 ScreenPartRegistration 转换为 ScreenPart（去除 componentType）
    const { componentType, ...screenPart } = registration
    return screenPart
}

/**
 * 获取指定 containerKey 下的所有 ScreenPartRegistration
 * @param containerKey 容器的 key
 * @returns 该容器下的所有 ScreenPartRegistration，按 indexInContainer 排序
 */
export function getScreenPartsByContainerKey(containerKey: string): ScreenPartRegistration[] {
    const screenMode = getScreenMode()
    return Array.from(screenRegistryMap[screenMode].values())
        .filter(part => part.containerKey === containerKey)
        .sort((a, b) => (a.indexInContainer ?? 0) - (b.indexInContainer ?? 0))
}


export const createModelScreen =
    <T>(screenPart: ScreenPart<any>, id: string, props: T) => {
        return {...screenPart, id, props}
    }

export const defaultAlertPartKey = "alert"

export const createAlert =
    (id: string, props: AlertInfo) => {
        return {
            id,
            props,
            partKey: defaultAlertPartKey,
            name: "Alert",
            title:"Alert",
            description:"Alert",
            screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE]
        }
    }