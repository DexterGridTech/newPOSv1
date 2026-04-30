import type {BenefitContextRef, BenefitRef} from '@next/kernel-business-benefit-types'

export const toBenefitContextKey = (contextRef: BenefitContextRef): string =>
    `${contextRef.contextType}:${contextRef.contextId}`

export const toBenefitRefKey = (benefitRef: BenefitRef): string =>
    `${benefitRef.templateKey}:${benefitRef.lineKey ?? ''}`

export const parseBenefitRefFromOpportunityId = (opportunityId: string): BenefitRef | undefined => {
    if (!opportunityId.startsWith('opp-')) {
        return undefined
    }
    const raw = opportunityId.slice('opp-'.length)
    const marker = '-template'
    if (raw.endsWith(marker)) {
        return {templateKey: raw.slice(0, -marker.length)}
    }
    const lastDash = raw.lastIndexOf('-')
    if (lastDash <= 0) {
        return undefined
    }
    return {
        templateKey: raw.slice(0, lastDash),
        lineKey: raw.slice(lastDash + 1),
    }
}
