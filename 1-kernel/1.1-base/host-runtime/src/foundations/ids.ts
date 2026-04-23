import type {
    ConnectionId,
    EnvelopeId,
    SessionId,
} from '@impos2/kernel-base-contracts'

const createHostIdPayload = (): string => {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export const createHostSessionId = (): SessionId => {
    return `hses_${createHostIdPayload()}` as SessionId
}

export const createHostConnectionId = (): ConnectionId => {
    return `hcon_${createHostIdPayload()}` as ConnectionId
}

export const createHostEnvelopeId = (): EnvelopeId => {
    return `henv_${createHostIdPayload()}` as EnvelopeId
}

export const createHostObservationId = (): string => {
    return `hobs_${createHostIdPayload()}`
}

export const createHostRuleId = (): string => {
    return `hrule_${createHostIdPayload()}`
}
