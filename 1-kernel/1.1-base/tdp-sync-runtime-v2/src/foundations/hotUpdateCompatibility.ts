import type {
    HotUpdateCompatibility,
    HotUpdateCompatibilityResult,
    HotUpdateCurrentFacts,
} from '../types'
import {HOT_UPDATE_REJECT_REASONS} from './hotUpdateTopic'

const compareVersion = (left: string, right: string): number => {
    const normalize = (value: string) => {
        const [mainPart = '', buildPart = ''] = value.split('+')
        const mainParts = mainPart
            .split('.')
            .map(part => Number(part) || 0)
        const buildParts = buildPart
            .split(/[^0-9]+/)
            .filter(Boolean)
            .map(part => Number(part) || 0)
        return [...mainParts, ...buildParts]
    }
    const leftParts = normalize(left)
    const rightParts = normalize(right)
    const length = Math.max(leftParts.length, rightParts.length)

    for (let index = 0; index < length; index += 1) {
        const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
        if (delta !== 0) {
            return delta
        }
    }

    return 0
}

export const evaluateHotUpdateCompatibility = (input: {
    current: HotUpdateCurrentFacts
    compatibility: HotUpdateCompatibility
    desiredBundleVersion: string
    currentBundleVersion: string
    rolloutMode?: 'active' | 'paused' | 'rollback'
    allowDowngrade?: boolean
}): HotUpdateCompatibilityResult => {
    const {current, compatibility} = input

    if (compatibility.appId !== current.appId) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.appIdMismatch}
    }
    if (compatibility.platform !== current.platform) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.platformMismatch}
    }
    if (compatibility.product !== current.product) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.productMismatch}
    }
    if (compatibility.runtimeVersion !== current.runtimeVersion) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.runtimeVersionMismatch}
    }
    if (
        compatibility.minAssemblyVersion
        && compareVersion(current.assemblyVersion, compatibility.minAssemblyVersion) < 0
    ) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.assemblyVersionOutOfRange}
    }
    if (
        compatibility.maxAssemblyVersion
        && compareVersion(current.assemblyVersion, compatibility.maxAssemblyVersion) > 0
    ) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.assemblyVersionOutOfRange}
    }
    if (compatibility.minBuildNumber != null && current.buildNumber < compatibility.minBuildNumber) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.buildNumberOutOfRange}
    }
    if (compatibility.maxBuildNumber != null && current.buildNumber > compatibility.maxBuildNumber) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.buildNumberOutOfRange}
    }
    if (
        compatibility.allowedChannels?.length
        && (!current.channel || !compatibility.allowedChannels.includes(current.channel))
    ) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.channelNotAllowed}
    }
    if (compatibility.requiredCapabilities?.some(item => !current.capabilities.includes(item))) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.missingCapability}
    }
    if (compatibility.forbiddenCapabilities?.some(item => current.capabilities.includes(item))) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.forbiddenCapability}
    }

    const downgrade = compareVersion(input.desiredBundleVersion, input.currentBundleVersion) < 0
    if (downgrade && !(input.rolloutMode === 'rollback' && input.allowDowngrade === true)) {
        return {ok: false, reason: HOT_UPDATE_REJECT_REASONS.downgradeNotAllowed}
    }

    return {ok: true}
}
