import {getScreenMode, ScreenMode, ScreenPart, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {ComponentType} from "react";
import {getInstanceMode, getWorkspace} from "@impos2/kernel-core-interconnection";
import {AlertInfo, OverlayEntry} from "../types";

const screenRegistryMap: Record<ScreenMode, Map<string, ScreenPartRegistration>> = {
    [ScreenMode.MOBILE]: new Map<string, ScreenPartRegistration>(),
    [ScreenMode.DESKTOP]: new Map<string, ScreenPartRegistration>()
}

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

export function getScreenPartReadyToEnter(key: string): (() => boolean) | undefined {
    const screenMode = getScreenMode()
    return screenRegistryMap[screenMode].get(key)?.readyToEnter
}

export function getFirstReadyScreenPartByContainerKey(containerKey: string, fromIndex: number): ScreenPart<any> | undefined {
    const screenMode = getScreenMode()
    const instanceMode = getInstanceMode()
    const workspace = getWorkspace()
    const registration = Array.from(screenRegistryMap[screenMode].values())
        .filter(part =>
            part.containerKey === containerKey &&
            part.indexInContainer != null &&
            part.indexInContainer > fromIndex &&
            part.workspace.includes(workspace) &&
            part.instanceMode.includes(instanceMode)
        )
        .sort((a, b) => (a.indexInContainer ?? 0) - (b.indexInContainer ?? 0))
        .find(part => part.readyToEnter?.() ?? true)

    if (!registration) {
        return undefined
    }

    const {componentType, ...screenPart} = registration
    return screenPart
}

export function getScreenPartsByContainerKey(containerKey: string): ScreenPartRegistration[] {
    const screenMode = getScreenMode()
    const instanceMode = getInstanceMode()
    const workspace = getWorkspace()
    return Array.from(screenRegistryMap[screenMode].values())
        .filter(part =>
            part.containerKey === containerKey &&
            part.workspace.includes(workspace) &&
            part.instanceMode.includes(instanceMode)
        )
        .sort((a, b) => (a.indexInContainer ?? 0) - (b.indexInContainer ?? 0))
}

export const createOverlayScreen = <T>(screenPart: ScreenPart<any>, id: string, props: T): ScreenPart<T> => {
    return {...screenPart, id, props}
}

export const createModalScreen = createOverlayScreen

export const createOverlayEntry = <T>(screenPart: ScreenPart<T>, id: string, props?: T): OverlayEntry<T> => {
    return {
        id,
        screenPartKey: screenPart.partKey,
        props,
        openedAt: Date.now()
    }
}

export const defaultAlertPartKey = "alert"

export const createAlert = (id: string, props: AlertInfo): ScreenPart<AlertInfo> => {
    return {
        id,
        props,
        partKey: defaultAlertPartKey,
        name: "Alert",
        title: "Alert",
        description: "Alert",
    }
}
