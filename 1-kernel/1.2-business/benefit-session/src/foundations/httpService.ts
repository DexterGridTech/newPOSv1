import type {
    ActivatedBenefitCodeResult,
    BenefitQuotaFact,
    BenefitReservation,
    BenefitSnapshot,
    CompletedSettlementSnapshot,
    CustomerIdentitySnapshot,
    SettlementLineCandidate,
} from '@next/kernel-business-benefit-types'
import {
    createHttpServiceBinder,
    createModuleHttpEndpointFactory,
    type HttpRuntime,
} from '@next/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@next/kernel-server-config-v2'
import {moduleName} from '../moduleName'
import {benefitSessionErrorDefinitions} from '../supports'
import type {
    BenefitCenterPort,
    BenefitCenterPortCodeActivationInput,
    BenefitCenterPortCompleteSettlementInput,
    BenefitCenterPortOrderFactQueryInput,
    BenefitCenterPortPersonalQueryInput,
    BenefitCenterPortReservationInput,
} from '../types'

interface BenefitCenterEnvelope<TData> {
    success: boolean
    data: TData
    error?: {
        message?: string
        details?: unknown
    }
}

const BENEFIT_SESSION_HTTP_FALLBACK_MESSAGE = 'benefit center request failed'

const defineEndpoint = createModuleHttpEndpointFactory(moduleName, SERVER_NAME_MOCK_TERMINAL_PLATFORM)

const queryPersonalBenefitsEndpoint = defineEndpoint<
    void,
    void,
    BenefitCenterPortPersonalQueryInput,
    BenefitCenterEnvelope<{
        identitySnapshot: CustomerIdentitySnapshot
        benefitSnapshot: BenefitSnapshot
    }>
>('query-personal-benefits', {
    method: 'POST',
    pathTemplate: '/api/commercial-benefit/personal-query',
    request: {
        body: true,
    },
})

const reserveBenefitEndpoint = defineEndpoint<
    void,
    void,
    BenefitCenterPortReservationInput,
    BenefitCenterEnvelope<BenefitReservation>
>('reserve-benefit', {
    method: 'POST',
    pathTemplate: '/api/commercial-benefit/reservations',
    request: {
        body: true,
    },
})

const releaseBenefitReservationEndpoint = defineEndpoint<
    {reservationId: string},
    void,
    {reservationId: string},
    BenefitCenterEnvelope<BenefitReservation>
>('release-benefit-reservation', {
    method: 'POST',
    pathTemplate: '/api/commercial-benefit/reservations/{reservationId}/release',
    request: {
        path: true,
        body: true,
    },
})

const promoteBenefitReservationEndpoint = defineEndpoint<
    {reservationId: string},
    void,
    {reservationId: string},
    BenefitCenterEnvelope<BenefitReservation>
>('promote-benefit-reservation', {
    method: 'POST',
    pathTemplate: '/api/commercial-benefit/reservations/{reservationId}/promote',
    request: {
        path: true,
        body: true,
    },
})

const activateBenefitCodeEndpoint = defineEndpoint<
    void,
    void,
    BenefitCenterPortCodeActivationInput,
    BenefitCenterEnvelope<ActivatedBenefitCodeResult>
>('activate-benefit-code', {
    method: 'POST',
    pathTemplate: '/api/commercial-benefit/codes/activate',
    request: {
        body: true,
    },
})

const queryOrderFactsEndpoint = defineEndpoint<
    void,
    BenefitCenterPortOrderFactQueryInput,
    void,
    BenefitCenterEnvelope<BenefitQuotaFact[]>
>('query-order-facts', {
    method: 'GET',
    pathTemplate: '/api/commercial-benefit/order-facts',
    request: {
        query: true,
    },
})

const completeSettlementFactEndpoint = defineEndpoint<
    void,
    void,
    BenefitCenterPortCompleteSettlementInput | SettlementLineCandidate,
    BenefitCenterEnvelope<CompletedSettlementSnapshot>
>('complete-settlement-fact', {
    method: 'POST',
    pathTemplate: '/api/commercial-benefit/payment-facts/settlements/complete',
    request: {
        body: true,
    },
})

const refundSettlementFactEndpoint = defineEndpoint<
    {settlementLineId: string},
    void,
    {settlementLineId: string; status: 'refunded'},
    BenefitCenterEnvelope<CompletedSettlementSnapshot>
>('refund-settlement-fact', {
    method: 'POST',
    pathTemplate: '/api/commercial-benefit/payment-facts/settlements/{settlementLineId}/refund',
    request: {
        path: true,
        body: true,
    },
})

const voidSettlementFactEndpoint = defineEndpoint<
    {settlementLineId: string},
    void,
    {settlementLineId: string; status: 'voided'},
    BenefitCenterEnvelope<CompletedSettlementSnapshot>
>('void-settlement-fact', {
    method: 'POST',
    pathTemplate: '/api/commercial-benefit/payment-facts/settlements/{settlementLineId}/void',
    request: {
        path: true,
        body: true,
    },
})

const requestError = {
    errorDefinition: benefitSessionErrorDefinitions.benefitCenterRequestFailed,
    fallbackMessage: BENEFIT_SESSION_HTTP_FALLBACK_MESSAGE,
}

export const createBenefitSessionHttpService = (
    runtime: HttpRuntime,
): BenefitCenterPort => {
    const http = createHttpServiceBinder(runtime)

    return {
        queryPersonalBenefits(input) {
            return http.envelope(queryPersonalBenefitsEndpoint, {body: input}, requestError)
        },
        reserveBenefit(input) {
            return http.envelope(reserveBenefitEndpoint, {body: input}, requestError)
        },
        releaseBenefitReservation(reservation) {
            return http.envelope(releaseBenefitReservationEndpoint, {
                path: {reservationId: reservation.reservationId},
                body: {reservationId: reservation.reservationId},
            }, requestError)
        },
        promoteBenefitReservation(reservation) {
            return http.envelope(promoteBenefitReservationEndpoint, {
                path: {reservationId: reservation.reservationId},
                body: {reservationId: reservation.reservationId},
            }, requestError)
        },
        activateBenefitCode(input) {
            return http.envelope(activateBenefitCodeEndpoint, {body: input}, requestError)
        },
        queryOrderFacts(input) {
            return http.envelope(queryOrderFactsEndpoint, {query: input}, requestError)
        },
        completeSettlementFact(input) {
            return http.envelope(completeSettlementFactEndpoint, {body: input}, requestError)
        },
        markSettlementFact(settlementLineId, status) {
            if (status === 'refunded') {
                return http.envelope(refundSettlementFactEndpoint, {
                    path: {settlementLineId},
                    body: {settlementLineId, status},
                }, requestError)
            }

            return http.envelope(voidSettlementFactEndpoint, {
                path: {settlementLineId},
                body: {settlementLineId, status},
            }, requestError)
        },
    }
}
