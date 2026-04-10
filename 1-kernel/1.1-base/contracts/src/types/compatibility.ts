export interface CompatibilityDecision {
    level: 'full' | 'degraded' | 'rejected'
    reasons: string[]
    enabledCapabilities: string[]
    disabledCapabilities: string[]
}
