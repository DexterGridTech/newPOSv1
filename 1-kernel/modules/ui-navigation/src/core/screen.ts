import {ScreenPart, ScreenPartRegistration} from "../types";
import {ComponentType} from "react";
import {getInstance, logger} from "@impos2/kernel-base";

/**
 * ScreenPart 注册信息存储
 */
// 按 category 分类存储的注册表
const screenRegistryMap = {
    mobile: new Map<string, ScreenPartRegistration>(),
    desktop: new Map<string, ScreenPartRegistration>()
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

/**
 * 获取 ScreenPart 的 componentType
 */
export function getScreenPartComponentType(key: string): ComponentType<any> | undefined {
    const screenMode = getInstance().screenMode
    return screenRegistryMap[screenMode].get(key)?.componentType
}

/**
 * 获取 ScreenPart 的 readyToEnter 方法
 */
export function getScreenPartReadyToEnter(key: string): (() => boolean) | undefined {
    const screenMode = getInstance().screenMode
    return screenRegistryMap[screenMode].get(key)?.readyToEnter
}

export function getFirstReadyScreenPartByContainerKey(containerKey: string, fromIndex: number): ScreenPart | undefined {
    const screenMode = getInstance().screenMode
    return Array.from(screenRegistryMap[screenMode].values())
        .filter(part =>
            part.containerKey === containerKey &&
            part.indexInContainer != null &&
            part.indexInContainer > fromIndex
        )
        .sort((a, b) => (a.indexInContainer ?? 0) - (b.indexInContainer ?? 0))
        .find(part => part.readyToEnter?.() ?? true)
}