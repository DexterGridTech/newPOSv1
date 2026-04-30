import type {
    BenefitEvaluationRequest,
    BenefitRef,
    BenefitTemplate,
    CustomerIdentitySnapshot,
    PaymentInstrumentSnapshot,
    ReservationSubjectRef,
} from '@next/kernel-business-benefit-types'

export interface ResolveReservationSubjectInput {
    template: BenefitTemplate
    benefitRef: BenefitRef
    identitySnapshot?: CustomerIdentitySnapshot
    paymentInstrument?: PaymentInstrumentSnapshot
}

export function resolveReservationSubjectRef(
    input: ResolveReservationSubjectInput,
): ReservationSubjectRef | undefined {
    const policy = input.template.reservationPolicy

    if (policy.subject === 'membership') {
        const membership = input.identitySnapshot?.identities
            .flatMap(identity => identity.memberships)
            .find(candidate =>
                candidate.status === 'active' &&
                dateWindowMatches(candidate) &&
                (!policy.subjectMembershipType || candidate.membershipType === policy.subjectMembershipType),
            )
        return membership
            ? {
                  subjectType: 'membership',
                  subjectKey: membership.membershipKey,
                  displayKey: membership.levelCode ?? membership.membershipType,
              }
            : undefined
    }

    if (policy.subject === 'benefitLine') {
        return input.benefitRef.lineKey
            ? {
                  subjectType: 'benefitLine',
                  subjectKey: input.benefitRef.lineKey,
              }
            : undefined
    }

    if (policy.subject === 'identity') {
        const identity = input.identitySnapshot?.identities.find(candidate =>
            candidate.status === 'active' &&
            (!policy.subjectIdentityType || candidate.identityType === policy.subjectIdentityType),
        )
        return identity
            ? {
                  subjectType: 'identity',
                  subjectKey: identity.identityKey,
                  displayKey: identity.displayName,
              }
            : undefined
    }

    if (policy.subject === 'entryIdentity') {
        const entryIdentity = input.identitySnapshot?.entryIdentity
        return entryIdentity
            ? {
                  subjectType: 'entryIdentity',
                  subjectKey: `${entryIdentity.identityType}:${entryIdentity.identityValue}`,
              }
            : undefined
    }

    if (policy.subject === 'paymentAccount') {
        return input.paymentInstrument?.accountRef
            ? {
                  subjectType: 'paymentAccount',
                  subjectKey: input.paymentInstrument.accountRef,
              }
            : undefined
    }

    return {
        subjectType: 'custom',
        subjectKey: benefitRefKey(input.benefitRef),
    }
}

export function resolveReservationSubjectRefFromRequest(
    template: BenefitTemplate,
    request: BenefitEvaluationRequest,
    benefitRef: BenefitRef,
): ReservationSubjectRef | undefined {
    return resolveReservationSubjectRef({
        template,
        benefitRef,
        identitySnapshot: request.identitySnapshot,
        paymentInstrument: request.subject.paymentInstrument,
    })
}

export function subjectRefMatches(left: ReservationSubjectRef, right: ReservationSubjectRef): boolean {
    return left.subjectType === right.subjectType && left.subjectKey === right.subjectKey
}

function benefitRefKey(benefitRef: BenefitRef): string {
    return `${benefitRef.templateKey}:${benefitRef.lineKey ?? ''}`
}

function dateWindowMatches(input: {validFrom?: string; validTo?: string}): boolean {
    const now = Date.now()
    const validFrom = parseTime(input.validFrom)
    const validTo = parseTime(input.validTo)
    if (validFrom !== undefined && now < validFrom) {
        return false
    }
    if (validTo !== undefined && now > validTo) {
        return false
    }
    return true
}

function parseTime(value?: string): number | undefined {
    if (!value) {
        return undefined
    }
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : parsed
}

