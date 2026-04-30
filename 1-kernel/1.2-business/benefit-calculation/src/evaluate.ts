import type {
    BenefitAllocation,
    BenefitApplication,
    BenefitEvaluationDiagnostic,
    BenefitEvaluationRequest,
    BenefitEvaluationResult,
    BenefitLine,
    BenefitOpportunity,
    BenefitPrompt,
    BenefitRef,
    BenefitTemplate,
    CommerceLineSnapshot,
    CommerceLinePriceLayer,
    CustomerIdentity,
    FulfillmentEffect,
    IdentityRequirement,
    MembershipProfile,
    MembershipRequirement,
    Money,
    ProductIdentityMatcher,
    ProductScopeRule,
    PricingAdjustment,
    SettlementGroupCandidate,
    SettlementLineCandidate,
} from '@next/kernel-business-benefit-types'
import {resolveCompletedSettlements} from './pipeline/resolveCompletedSettlements'
import {
    resolveReservationSubjectRefFromRequest,
    subjectRefMatches,
} from './pipeline/resolveReservationSubject'

export function evaluateBenefitRequest(request: BenefitEvaluationRequest): BenefitEvaluationResult {
    const opportunities: BenefitOpportunity[] = []
    const prompts: BenefitPrompt[] = []
    const applications: BenefitApplication[] = []
    const pricingAdjustments: PricingAdjustment[] = []
    const priceLayers: CommerceLinePriceLayer[] = []
    const fulfillmentEffects: FulfillmentEffect[] = []
    const settlementGroups: SettlementGroupCandidate[] = []
    const settlementLines: SettlementLineCandidate[] = []
    const allocations: BenefitAllocation[] = []
    const diagnostics: BenefitEvaluationDiagnostic[] = []

    // 已完成支付行是支付阶段继续计算的事实基础：
    // 订单 300.00 元先核销 100.00 元券、再微信付 150.00 元后，
    // 后续积分/钱包/支付优惠只能基于剩余 50.00 元继续计算。
    const completedSettlements = resolveCompletedSettlements(request)

    for (const template of request.benefitSnapshot.templates) {
        const refs = resolveBenefitRefs(template, request.benefitSnapshot.lines)

        for (const benefitRef of refs) {
            const benefitLine = findLine(request.benefitSnapshot.lines, benefitRef)
            const lineUnavailableReason = findLineUnavailableReason(benefitLine)
            if (lineUnavailableReason) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: lineUnavailableReason,
                })
                continue
            }

            if (!lifecycleMatches(template)) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'lineExpired',
                    },
                })
                continue
            }

            // 商品行可以明确声明“不参与任何权益”。例如充值商品、服务费、受监管商品。
            // 这个开关优先级高于模板的商品范围配置，避免某个活动误把禁止优惠商品纳入门槛。
            const excludedLineIds = request.subject.lines
                .filter((line) => line.benefitParticipation?.mode === 'excludeAllBenefits')
                .map((line) => line.lineId)
            const eligibleLines = request.subject.lines.filter(
                (line) => line.benefitParticipation?.mode !== 'excludeAllBenefits',
            )

            if (eligibleLines.length === 0 && excludedLineIds.length > 0) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'productExcluded',
                        lineIds: excludedLineIds,
                    },
                })
                diagnostics.push({
                    diagnosticId: `diag-product-excluded-${template.templateKey}`,
                    level: 'info',
                    code: 'productExcluded',
                    benefitRef,
                    message: 'All commerce lines are excluded from benefit calculation.',
                })
                continue
            }

            const scopedLines = filterLinesByProductScope(eligibleLines, template.eligibilityPolicy.productScope)
            if (scopedLines.length === 0 && eligibleLines.length > 0) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'eligibilityNotMet',
                        failedRequirements: ['productScope'],
                    },
                })
                continue
            }

            const applicableStages = template.eligibilityPolicy.applicableStages
            if (applicableStages?.length && !applicableStages.includes(request.stage)) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'stageNotApplicable',
                        applicableStages,
                    },
                })
                continue
            }

            const eligibilityFailures = evaluateEligibility(template, request)
            if (eligibilityFailures.length > 0) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'eligibilityNotMet',
                        failedRequirements: eligibilityFailures,
                    },
                })
                continue
            }

            // minimumPayableAmount 使用“扣掉已完成支付/权益支付后的剩余应付”。
            // 这保护支付阶段的分步支付：已经付掉 250.00 元后，不能再按原订单金额继续套满减。
            const minimumPayableResult = matchMinimumPayableAmount(
                template,
                resolveRemainingPayable(request, completedSettlements),
            )
            if (!minimumPayableResult.matched) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'thresholdNotMet',
                        required: minimumPayableResult.required,
                        current: minimumPayableResult.current,
                    },
                })
                continue
            }

            const nonAmountThresholdFailures = evaluateNonAmountThresholds(template, scopedLines)
            if (nonAmountThresholdFailures.length > 0) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'eligibilityNotMet',
                        failedRequirements: nonAmountThresholdFailures,
                    },
                })
                continue
            }

            const thresholdResult = matchThreshold(template, request, scopedLines, completedSettlements)
            if (!thresholdResult.matched) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'thresholdNotMet',
                        required: thresholdResult.required,
                        current: thresholdResult.current,
                    },
                })
                continue
            }

            const exhaustedBucketKey = findExhaustedQuotaBucket(template, request, benefitRef)
            if (exhaustedBucketKey) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'quotaExhausted',
                        bucketKey: exhaustedBucketKey,
                    },
                })
                continue
            }

            const reservationConflict = findReservationConflict(request, benefitRef)
            if (reservationConflict) {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'unavailable',
                    unavailableReason: {
                        code: 'reservedByOtherContext',
                        contextRef: reservationConflict.contextRef,
                    },
                })
                continue
            }

            // 支付优惠先返回 conditional 机会而不是直接使用：
            // 前端可以提示“使用预付卡支付可减 20.00 元”，但只有选择了对应支付工具才生成支付单候选。
            if (template.effectPolicy.kind === 'paymentMethodDiscount' && !paymentInstrumentMatches(template, request)) {
                prompts.push({
                    promptId: `prompt-${buildOpportunityId(benefitRef)}`,
                    benefitRef,
                    triggerAction: 'selectPaymentInstrument',
                    effectPreview: previewAmountOff(template),
                })
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'conditional',
                    requiredAction: 'selectPaymentInstrument',
                    maxEffectPreview: previewAmountOff(template),
                })
                continue
            }

            // 券、积分、赠品池等选择型权益要先进入 opportunities。
            // “可用”和“已使用”分开，避免前端只是展示可用券时就把券算进订单金额。
            if (template.selectionPolicy.mode !== 'auto') {
                opportunities.push({
                    opportunityId: buildOpportunityId(benefitRef),
                    benefitRef,
                    availability: 'available',
                    requiredAction: requiredActionForSelection(template),
                    maxEffectPreview: previewAmountOff(template),
                })

                if (isSelected(request, benefitRef)) {
                    const selected = buildSelectedApplication({
                        request,
                        template,
                        benefitRef,
                        eligibleLines: scopedLines,
                        remainingPayable: resolveRemainingPayable(request, completedSettlements),
                        line: benefitLine,
                    })
                    applications.push(selected.application)
                    allocations.push(...selected.allocations)
                    pricingAdjustments.push(...selected.pricingAdjustments)
                    priceLayers.push(...selected.priceLayers)
                    fulfillmentEffects.push(...selected.fulfillmentEffects)
                    settlementGroups.push(...selected.settlementGroups)
                    settlementLines.push(...selected.settlementLines)
                }
                continue
            }

            const opportunity: BenefitOpportunity = {
                opportunityId: buildOpportunityId(benefitRef),
                benefitRef,
                availability: 'available',
                maxEffectPreview: previewAmountOff(template),
            }
            opportunities.push(opportunity)

            // 自动调价权益直接影响商品现价。例如购物车满 200.00 减 20.00，
            // 订单确认金额应基于 180.00 继续，而不是把这 20.00 当支付单候选。
            const pricingApplication = buildAutoPricingApplication({
                request,
                template,
                benefitRef,
                opportunity,
                eligibleLines: scopedLines,
            })
            if (pricingApplication) {
                applications.push(pricingApplication.application)
                allocations.push(...pricingApplication.allocations)
                pricingAdjustments.push(pricingApplication.pricingAdjustment)
                priceLayers.push(...pricingApplication.priceLayers)
            } else if (template.effectPolicy.kind === 'paymentMethodDiscount') {
                const selected = buildSelectedApplication({
                    request,
                    template,
                    benefitRef,
                    eligibleLines: scopedLines,
                    remainingPayable: resolveRemainingPayable(request, completedSettlements),
                    line: benefitLine,
                })
                applications.push(selected.application)
                settlementGroups.push(...selected.settlementGroups)
                settlementLines.push(...selected.settlementLines)
            } else {
                diagnostics.push({
                    diagnosticId: `diag-unsupported-${template.templateKey}`,
                    level: 'warn',
                    code: 'unsupportedEffectKind',
                    benefitRef,
                    message: `Unsupported effect kind: ${template.effectPolicy.kind}`,
                })
            }
        }
    }

    // 先完整生成候选，再统一处理叠加/互斥。
    // 这样 result.opportunities 仍能告诉店员“哪些权益可用但冲突”，最终 applications 只保留真正生效的组合。
    const stackedApplications = resolveStacking(applications, diagnostics, request.benefitSnapshot.templates)
    const keptApplicationIds = new Set(stackedApplications.map((application) => application.applicationId))
    const keptBenefitKeys = new Set(stackedApplications.map((application) => benefitKey(application.benefitRef)))

    return {
        contextRef: request.contextRef,
        stage: request.stage,
        opportunities,
        prompts,
        applications: stackedApplications,
        pricingAdjustments: pricingAdjustments.filter((adjustment) => keptBenefitKeys.has(benefitKey(adjustment.benefitRef))),
        priceLayers: priceLayers.filter((layer) => keptBenefitKeys.has(benefitKey(layer.benefitRef ?? {templateKey: ''}))),
        fulfillmentEffects: fulfillmentEffects.filter((effect) => keptBenefitKeys.has(benefitKey(effect.benefitRef))),
        settlementGroups,
        settlementLines: settlementLines.filter((line) => !line.benefitRef || keptBenefitKeys.has(benefitKey(line.benefitRef))),
        allocations: allocations.filter(
            (allocation) =>
                (allocation.applicationId && keptApplicationIds.has(allocation.applicationId)) ||
                keptBenefitKeys.has(benefitKey(allocation.benefitRef)),
        ),
        diagnostics,
    }
}

function resolveBenefitRefs(template: BenefitTemplate, lines: BenefitLine[]): BenefitRef[] {
    const matchingLines = lines.filter((line) => line.templateKey === template.templateKey)

    if (matchingLines.length === 0) {
        return [{templateKey: template.templateKey}]
    }

    return matchingLines.map((line) => ({
        templateKey: template.templateKey,
        lineKey: line.lineKey,
    }))
}

function buildOpportunityId(benefitRef: BenefitRef): string {
    return `opp-${benefitRef.templateKey}-${benefitRef.lineKey ?? 'template'}`
}

function benefitKey(benefitRef: BenefitRef): string {
    return `${benefitRef.templateKey}:${benefitRef.lineKey ?? ''}`
}

function findLineUnavailableReason(line?: BenefitLine): BenefitOpportunity['unavailableReason'] | undefined {
    if (!line) {
        return undefined
    }

    if (line.status === 'consumed') {
        return {code: 'lineConsumed'}
    }

    if (line.status === 'expired' || line.status === 'voided') {
        return {code: 'lineExpired'}
    }

    if (!dateWindowMatches({validFrom: line.availableFrom, validTo: line.availableTo})) {
        return {code: 'lineExpired'}
    }

    return undefined
}

function lifecycleMatches(template: BenefitTemplate): boolean {
    return template.status === 'active' && dateWindowMatches(template.lifecyclePolicy)
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

function filterLinesByProductScope(
    lines: CommerceLineSnapshot[],
    scope?: ProductScopeRule,
): CommerceLineSnapshot[] {
    if (!scope || scope.mode === 'all') {
        return lines
    }

    return lines.filter((line) => lineMatchesScope(line, scope))
}

function evaluateEligibility(template: BenefitTemplate, request: BenefitEvaluationRequest): string[] {
    const failures: string[] = []
    const policy = template.eligibilityPolicy

    if (!identityRequirementsMatch(policy.identityRequirements, request)) {
        failures.push('identityRequirements')
    }
    if (!membershipRequirementsMatch(policy.membershipRequirements, request)) {
        failures.push('membershipRequirements')
    }
    if (!timeWindowMatches(policy.timeWindow)) {
        failures.push('timeWindow')
    }
    if (!terminalRequirementsMatch(policy.terminalRequirements, request)) {
        failures.push('terminalRequirements')
    }
    if (!channelRequirementsMatch(policy.channelRequirements, request)) {
        failures.push('channelRequirements')
    }

    return failures
}

function identityRequirementsMatch(
    requirements: IdentityRequirement[] | undefined,
    request: BenefitEvaluationRequest,
): boolean {
    const required = requirements?.filter((requirement) => requirement.required !== false) ?? []
    if (required.length === 0) {
        return true
    }

    return required.every((requirement) => request.identitySnapshot !== undefined && identityRequirementMatches(requirement, request))
}

function identityRequirementMatches(requirement: IdentityRequirement, request: BenefitEvaluationRequest): boolean {
    const identities = request.identitySnapshot?.identities ?? []
    const activeIdentityMatches = identities.some(
        (identity) => identity.status === 'active' && identityMatchesRequirement(identity, requirement),
    )
    if (activeIdentityMatches) {
        return true
    }

    const entryIdentity = request.identitySnapshot?.entryIdentity
    if (!entryIdentity || requirement.identityKeys?.length) {
        return false
    }
    return !requirement.identityType || entryIdentity.identityType === requirement.identityType
}

function identityMatchesRequirement(identity: CustomerIdentity, requirement: IdentityRequirement): boolean {
    if (requirement.identityType && identity.identityType !== requirement.identityType) {
        return false
    }
    if (requirement.identityKeys && !requirement.identityKeys.includes(identity.identityKey)) {
        return false
    }
    return true
}

function membershipRequirementsMatch(
    requirements: MembershipRequirement[] | undefined,
    request: BenefitEvaluationRequest,
): boolean {
    if (!requirements?.length) {
        return true
    }

    const memberships = request.identitySnapshot?.identities
        .flatMap((identity) => identity.memberships)
        .filter((membership) => membership.status === 'active' && dateWindowMatches(membership)) ?? []

    return requirements.every((requirement) =>
        memberships.some((membership) => membershipMatchesRequirement(membership, requirement)),
    )
}

function membershipMatchesRequirement(membership: MembershipProfile, requirement: MembershipRequirement): boolean {
    if (requirement.membershipType && membership.membershipType !== requirement.membershipType) {
        return false
    }
    if (requirement.membershipKeys && !requirement.membershipKeys.includes(membership.membershipKey)) {
        return false
    }
    if (requirement.planCodes && !requirement.planCodes.includes(membership.planCode)) {
        return false
    }
    const membershipLevelCodes = new Set([membership.levelCode, ...(membership.levelCodes ?? [])].filter(Boolean))
    if (requirement.levelCode && !membershipLevelCodes.has(requirement.levelCode)) {
        return false
    }
    if (requirement.levelCodes && !requirement.levelCodes.some((levelCode) => membershipLevelCodes.has(levelCode))) {
        return false
    }
    if (requirement.qualificationAttributes && !attributesMatch(
        membership.qualificationAttributes,
        requirement.qualificationAttributes,
    )) {
        return false
    }
    return true
}

function attributesMatch(actual: Record<string, unknown> | undefined, expected: Record<string, unknown>): boolean {
    return Object.entries(expected).every(([key, value]) => actual?.[key] === value)
}

function timeWindowMatches(window: BenefitTemplate['eligibilityPolicy']['timeWindow']): boolean {
    if (!window) {
        return true
    }
    if (!dateWindowMatches(window)) {
        return false
    }

    const now = new Date()
    if (window.weekDays && !window.weekDays.includes(now.getDay())) {
        return false
    }
    if (window.dayTimeRanges?.length) {
        const minutes = now.getHours() * 60 + now.getMinutes()
        return window.dayTimeRanges.some((range) => {
            const start = parseDayTime(range.start)
            const end = parseDayTime(range.end)
            if (start === undefined || end === undefined) {
                return true
            }
            return start <= end
                ? minutes >= start && minutes <= end
                : minutes >= start || minutes <= end
        })
    }
    return true
}

function parseDayTime(value: string): number | undefined {
    const matched = /^(\d{1,2}):(\d{2})$/.exec(value)
    if (!matched) {
        return undefined
    }
    const hours = Number(matched[1])
    const minutes = Number(matched[2])
    if (hours > 23 || minutes > 59) {
        return undefined
    }
    return hours * 60 + minutes
}

function terminalRequirementsMatch(
    requirements: BenefitTemplate['eligibilityPolicy']['terminalRequirements'],
    request: BenefitEvaluationRequest,
): boolean {
    if (!requirements?.length) {
        return true
    }
    return requirements.some((requirement) => {
        if (requirement.terminalNos && !requirement.terminalNos.includes(request.subject.terminalNo)) {
            return false
        }
        if (requirement.organizationCodes?.length) {
            const organizationCode = request.subject.attributes?.organizationCode
            if (typeof organizationCode !== 'string' || !requirement.organizationCodes.includes(organizationCode)) {
                return false
            }
        }
        return true
    })
}

function channelRequirementsMatch(
    requirements: BenefitTemplate['eligibilityPolicy']['channelRequirements'],
    request: BenefitEvaluationRequest,
): boolean {
    if (!requirements?.length) {
        return true
    }
    return requirements.some((requirement) => {
        if (!requirement.channelCodes?.length) {
            return true
        }
        return Boolean(request.subject.channelCode && requirement.channelCodes.includes(request.subject.channelCode))
    })
}

function requiredActionForSelection(template: BenefitTemplate): BenefitOpportunity['requiredAction'] {
    switch (template.selectionPolicy.mode) {
        case 'manual':
        case 'customerChoose':
            return 'selectBenefit'
        case 'clerkChoose':
            return template.effectPolicy.kind === 'giftPool' ? 'chooseGift' : 'selectBenefit'
        case 'conditional':
            return 'selectPaymentInstrument'
        case 'codeActivated':
            return 'enterCode'
        case 'auto':
            return undefined
    }
}

function previewAmountOff(template: BenefitTemplate): BenefitOpportunity['maxEffectPreview'] {
    switch (template.effectPolicy.kind) {
        case 'amountOff':
            return {
                effectKind: 'amountOff',
                estimatedAmount: template.effectPolicy.amount,
            }
        case 'paymentMethodDiscount':
            return {
                effectKind: 'paymentMethodDiscount',
                estimatedAmount: template.effectPolicy.discountAmount,
            }
        default:
            return {
                effectKind: template.effectPolicy.kind,
            }
    }
}

function matchThreshold(
    template: BenefitTemplate,
    request: BenefitEvaluationRequest,
    eligibleLines: CommerceLineSnapshot[],
    completedSettlements: ReturnType<typeof resolveCompletedSettlements>,
): {matched: true} | {matched: false; required: Money; current: Money} {
    const amountRequirement = template.eligibilityPolicy.thresholdRequirements?.find(
        (requirement) => requirement.thresholdType === 'amount' && requirement.amount,
    )

    if (!amountRequirement?.amount) {
        return {matched: true}
    }

    const current =
        template.basisPolicy.thresholdBase === 'originalAmount'
            ? sumLineAmount(eligibleLines, 'original')
            : template.basisPolicy.thresholdBase === 'afterSelectedPricingAdjustments'
              ? amountAfterCompletedPricingAdjustments(request, eligibleLines, completedSettlements)
            : template.basisPolicy.thresholdBase === 'currentRemainingAmount'
              ? request.subject.totals.payableAmount
              : request.subject.totals.currentAmount

    const matched = compareAmount(current.amount, amountRequirement.operator, amountRequirement.amount.amount)
    return matched
        ? {matched: true}
        : {
              matched: false,
              required: amountRequirement.amount,
              current,
          }
}

function evaluateNonAmountThresholds(template: BenefitTemplate, eligibleLines: CommerceLineSnapshot[]): string[] {
    const requirements = template.eligibilityPolicy.thresholdRequirements ?? []
    const failures: string[] = []

    requirements.forEach((requirement) => {
        if (requirement.thresholdType === 'quantity' && requirement.quantity !== undefined) {
            const currentQuantity = eligibleLines.reduce((sum, line) => sum + line.quantity, 0)
            if (!compareAmount(currentQuantity, requirement.operator, requirement.quantity)) {
                failures.push('thresholdRequirements.quantity')
            }
        }
        if (requirement.thresholdType === 'lineCount' && requirement.quantity !== undefined) {
            if (!compareAmount(eligibleLines.length, requirement.operator, requirement.quantity)) {
                failures.push('thresholdRequirements.lineCount')
            }
        }
    })

    return failures
}

function amountAfterCompletedPricingAdjustments(
    request: BenefitEvaluationRequest,
    eligibleLines: CommerceLineSnapshot[],
    completedSettlements: ReturnType<typeof resolveCompletedSettlements>,
): Money {
    const currentAmount = sumLineAmount(eligibleLines, 'current')
    const pricingImpact = completedSettlements
        .filter((settlement) => settlement.status === 'completed' || settlement.status === 'partiallyRefunded')
        .filter((settlement) => settlement.lineType === 'pricing_adjustment_record')
        .reduce((sum, settlement) => sum + settlement.payableImpactAmount.amount, 0)

    return {
        amount: Math.max(0, currentAmount.amount - pricingImpact),
        currency: request.subject.currency,
    }
}

function matchMinimumPayableAmount(
    template: BenefitTemplate,
    remainingPayable: Money,
): {matched: true} | {matched: false; required: Money; current: Money} {
    const required = template.eligibilityPolicy.minimumPayableAmount
    if (!required) {
        return {matched: true}
    }

    return remainingPayable.amount >= required.amount
        ? {matched: true}
        : {matched: false, required, current: remainingPayable}
}

function compareAmount(current: number, operator: 'gt' | 'gte' | 'eq' | 'lte' | 'lt', required: number): boolean {
    switch (operator) {
        case 'gt':
            return current > required
        case 'gte':
            return current >= required
        case 'eq':
            return current === required
        case 'lte':
            return current <= required
        case 'lt':
            return current < required
    }
}

function sumLineAmount(lines: CommerceLineSnapshot[], source: 'original' | 'current'): Money {
    const first = lines[0]
    const currency = first?.currentLineAmount.currency ?? first?.originalLineAmount.currency ?? 'CNY'
    const amount = lines.reduce(
        (sum, line) => sum + (source === 'original' ? line.originalLineAmount.amount : line.currentLineAmount.amount),
        0,
    )

    return {amount, currency}
}

function capMoney(amount: Money, cap: Money): Money {
    return {
        amount: Math.min(amount.amount, cap.amount),
        currency: amount.currency,
    }
}

function allocateByAmount(input: {
    benefitRef: BenefitRef
    applicationId: string
    amount: Money
    lines: CommerceLineSnapshot[]
}): BenefitAllocation[] {
    const total = sumLineAmount(input.lines, 'current').amount
    if (total <= 0 || input.amount.amount <= 0) {
        return []
    }

    let allocated = 0
    return input.lines.map((line, index) => {
        const isLast = index === input.lines.length - 1
        const amount = isLast
            ? input.amount.amount - allocated
            : Math.floor((input.amount.amount * line.currentLineAmount.amount) / total)
        allocated += amount

        return {
            allocationId: `alloc-${input.applicationId}-${line.lineId}`,
            benefitRef: input.benefitRef,
            applicationId: input.applicationId,
            targetLineId: line.lineId,
            allocatedAmount: {
                amount,
                currency: input.amount.currency,
            },
            allocationRatio: line.currentLineAmount.amount / total,
        }
    })
}

function isSelected(request: BenefitEvaluationRequest, benefitRef: BenefitRef): boolean {
    return (
        request.selectedApplications?.some(
            (selected) =>
                selected.benefitRef.templateKey === benefitRef.templateKey &&
                selected.benefitRef.lineKey === benefitRef.lineKey,
        ) ?? false
    )
}

function findSelectedQuantity(request: BenefitEvaluationRequest, benefitRef: BenefitRef): number | undefined {
    return request.selectedApplications?.find(
        (selected) =>
            selected.benefitRef.templateKey === benefitRef.templateKey && selected.benefitRef.lineKey === benefitRef.lineKey,
    )?.selectedQuantity
}

function findLine(lines: BenefitLine[], benefitRef: BenefitRef): BenefitLine | undefined {
    return lines.find((line) => line.templateKey === benefitRef.templateKey && line.lineKey === benefitRef.lineKey)
}

function paymentInstrumentMatches(template: BenefitTemplate, request: BenefitEvaluationRequest): boolean {
    const scope = template.eligibilityPolicy.paymentInstrumentScope
    if (!scope) {
        return true
    }

    const instrument = request.subject.paymentInstrument
    if (!instrument) {
        return false
    }

    if (scope.instrumentTypes && !scope.instrumentTypes.includes(instrument.instrumentType)) {
        return false
    }
    if (scope.accountRefs && (!instrument.accountRef || !scope.accountRefs.includes(instrument.accountRef))) {
        return false
    }
    if (scope.issuerCodes && (!instrument.issuerCode || !scope.issuerCodes.includes(instrument.issuerCode))) {
        return false
    }
    if (scope.productCodes && (!instrument.productCode || !scope.productCodes.includes(instrument.productCode))) {
        return false
    }
    if (
        scope.acquiringTypeCodes &&
        (!instrument.acquiringTypeCode || !scope.acquiringTypeCodes.includes(instrument.acquiringTypeCode))
    ) {
        return false
    }
    if (
        scope.acquiringInstitutionCodes &&
        (!instrument.acquiringInstitutionCode ||
            !scope.acquiringInstitutionCodes.includes(instrument.acquiringInstitutionCode))
    ) {
        return false
    }
    if (
        scope.acquiringProductCodes &&
        (!instrument.acquiringProductCode || !scope.acquiringProductCodes.includes(instrument.acquiringProductCode))
    ) {
        return false
    }

    return true
}

function buildSelectedApplication(input: {
    request: BenefitEvaluationRequest
    template: BenefitTemplate
    benefitRef: BenefitRef
    eligibleLines: CommerceLineSnapshot[]
    remainingPayable: Money
    line?: BenefitLine
}): {
    application: BenefitApplication
    allocations: BenefitAllocation[]
    pricingAdjustments: PricingAdjustment[]
    priceLayers: CommerceLinePriceLayer[]
    settlementGroups: SettlementGroupCandidate[]
    settlementLines: SettlementLineCandidate[]
    fulfillmentEffects: FulfillmentEffect[]
} {
    const opportunityId = buildOpportunityId(input.benefitRef)
    const applicationId = `app-${opportunityId}`
    const selectedQuantity = findSelectedQuantity(input.request, input.benefitRef) ?? 1

    if (input.template.effectPolicy.kind === 'amountOff') {
        const amount = capMoney(input.template.effectPolicy.amount, sumLineAmount(input.eligibleLines, 'current'))
        const allocations = allocateByAmount({
            benefitRef: input.benefitRef,
            applicationId,
            amount,
            lines: input.eligibleLines,
        })
        const priceLayers = input.template.settlementPolicy.createSettlementLineCandidate
            ? []
            : buildPriceLayers({
                  request: input.request,
                  benefitRef: input.benefitRef,
                  applicationId,
                  priceEffect: 'amountOff',
                  allocations,
                  targetLines: input.eligibleLines,
              })
        return {
            application: {
                applicationId,
                opportunityId,
                benefitRef: input.benefitRef,
                state: 'selected',
                selectedQuantity,
                actualEffect: {
                    kind: input.template.settlementPolicy.createSettlementLineCandidate
                        ? 'settlementCandidate'
                        : 'pricingAdjustment',
                    payableImpactAmount: amount,
                    amount,
                    targetLineIds: input.eligibleLines.map((line) => line.lineId),
                },
                allocations,
            },
            allocations,
            pricingAdjustments: input.template.settlementPolicy.createSettlementLineCandidate
                ? []
                : [
                      {
                          adjustmentId: `adj-${applicationId}`,
                          benefitRef: input.benefitRef,
                          amount,
                          targetLineIds: input.eligibleLines.map((line) => line.lineId),
                          allocationIds: allocations.map((allocation) => allocation.allocationId),
                          priceLayerIds: priceLayers.map((layer) => layer.layerId),
                          priceEffect: 'amountOff',
                          affectsOrderPayable: true,
                      },
                  ],
            settlementGroups: [],
            priceLayers,
            fulfillmentEffects: [],
            settlementLines: input.template.settlementPolicy.createSettlementLineCandidate
                ? [
                      {
                          settlementLineId: `settle-${applicationId}`,
                          benefitRef: input.benefitRef,
                          lineType: input.template.settlementPolicy.settlementLineType,
                          quantity: selectedQuantity,
                          quantityUnit: input.template.settlementPolicy.quantityUnit,
                          payableImpactAmount: amount,
                          benefitValueAmount: amount,
                          settlementPayloadSnapshot: mergeSettlementPayload(input.template.settlementPayload, input.line?.settlementPayload),
                      },
                  ]
                : [],
        }
    }

    if (input.template.effectPolicy.kind === 'pointsDeduction') {
        const availablePoints = input.line?.quantity ?? 0
        const requestedPoints = selectedQuantity
        const maxPoints = input.template.effectPolicy.maxPoints ?? requestedPoints
        const quantity = Math.min(requestedPoints, availablePoints, maxPoints)
        const amount = capMoney(
            {
                amount: Math.floor(quantity / input.template.effectPolicy.pointsPerMoneyUnit) * 100,
                currency: input.request.subject.currency,
            },
            input.remainingPayable,
        )

        return {
            application: {
                applicationId,
                opportunityId,
                benefitRef: input.benefitRef,
                state: 'selected',
                selectedQuantity: quantity,
                actualEffect: {
                    kind: 'settlementCandidate',
                    payableImpactAmount: amount,
                    quantity,
                },
            },
            allocations: [],
            pricingAdjustments: [],
            priceLayers: [],
            settlementGroups: [],
            fulfillmentEffects: [],
            settlementLines: [
                {
                    settlementLineId: `settle-${applicationId}`,
                    benefitRef: input.benefitRef,
                    lineType: input.template.settlementPolicy.settlementLineType,
                    quantity,
                    quantityUnit: input.template.settlementPolicy.quantityUnit,
                    payableImpactAmount: amount,
                    settlementPayloadSnapshot: mergeSettlementPayload(input.template.settlementPayload, input.line?.settlementPayload),
                },
            ],
        }
    }

    if (input.template.effectPolicy.kind === 'storedValueDeduction') {
        const requestedAmount = findSelectedQuantity(input.request, input.benefitRef)
            ?? input.template.effectPolicy.maxDeductionAmount?.amount
            ?? input.line?.balanceAmount?.amount
            ?? input.remainingPayable.amount
        const balanceAmount = input.line?.balanceAmount?.amount ?? requestedAmount
        const amount = capMoney(
            {
                amount: Math.min(requestedAmount, balanceAmount),
                currency: input.remainingPayable.currency,
            },
            input.remainingPayable,
        )

        return {
            application: {
                applicationId,
                opportunityId,
                benefitRef: input.benefitRef,
                state: 'selected',
                selectedQuantity: amount.amount,
                actualEffect: {
                    kind: 'settlementCandidate',
                    payableImpactAmount: amount,
                    quantity: amount.amount,
                },
            },
            allocations: [],
            pricingAdjustments: [],
            priceLayers: [],
            settlementGroups: [],
            fulfillmentEffects: [],
            settlementLines: [
                {
                    settlementLineId: `settle-${applicationId}`,
                    benefitRef: input.benefitRef,
                    lineType: input.template.settlementPolicy.settlementLineType,
                    quantity: amount.amount,
                    quantityUnit: input.template.settlementPolicy.quantityUnit,
                    payableImpactAmount: amount,
                    benefitValueAmount: amount,
                    settlementPayloadSnapshot: mergeSettlementPayload(input.template.settlementPayload, input.line?.settlementPayload),
                },
            ],
        }
    }

    if (input.template.effectPolicy.kind === 'paymentMethodDiscount') {
        const coverageAmount = input.remainingPayable
        const discountAmount = resolvePaymentDiscountAmount(input.template, coverageAmount)
        const externalRequestAmount = {
            amount: coverageAmount.amount - discountAmount.amount,
            currency: coverageAmount.currency,
        }
        const groupId = `group-${applicationId}`
        const chargeLineId = `settle-${applicationId}-charge`
        const discountLineId = `settle-${applicationId}-discount`

        return {
            application: {
                applicationId,
                opportunityId,
                benefitRef: input.benefitRef,
                state: 'selected',
                selectedQuantity: 1,
                actualEffect: {
                    kind: 'settlementCandidate',
                    payableImpactAmount: discountAmount,
                },
            },
            allocations: [],
            pricingAdjustments: [],
            priceLayers: [],
            settlementGroups: [
                {
                    settlementGroupId: groupId,
                    contextRef: input.request.contextRef,
                    coverageAmount,
                    refundAnchorAmount: coverageAmount,
                    externalRequestAmount,
                    lineIds: [chargeLineId, discountLineId],
                },
            ],
            fulfillmentEffects: [],
            settlementLines: [
                {
                    settlementLineId: chargeLineId,
                    settlementGroupId: groupId,
                    lineType: 'stored_value_deduction',
                    payableImpactAmount: externalRequestAmount,
                    externalRequestAmount,
                },
                {
                    settlementLineId: discountLineId,
                    settlementGroupId: groupId,
                    benefitRef: input.benefitRef,
                    lineType: input.template.settlementPolicy.settlementLineType,
                    payableImpactAmount: discountAmount,
                    benefitValueAmount: discountAmount,
                    settlementPayloadSnapshot: input.template.settlementPayload,
                },
            ],
        }
    }

    return {
        application: {
            applicationId,
            opportunityId,
            benefitRef: input.benefitRef,
            state: 'selected',
            selectedQuantity,
            actualEffect: {
                kind: 'promptOnly',
            },
        },
        allocations: [],
        pricingAdjustments: [],
        priceLayers: [],
        settlementGroups: [],
        fulfillmentEffects: buildSelectedFulfillmentEffects(input),
        settlementLines: buildFulfillmentSettlementLines({
            applicationId,
            input,
        }),
    }
}

function buildFulfillmentSettlementLines(input: {
    applicationId: string
    input: {
        request: BenefitEvaluationRequest
        template: BenefitTemplate
        benefitRef: BenefitRef
        line?: BenefitLine
    }
}): SettlementLineCandidate[] {
    const {template, benefitRef, request, line} = input.input
    if (!template.settlementPolicy.createSettlementLineCandidate) {
        return []
    }

    if (template.effectPolicy.kind === 'exchangeLine') {
        return [
            {
                settlementLineId: `settle-${input.applicationId}`,
                benefitRef,
                lineType: template.settlementPolicy.settlementLineType,
                quantity: template.effectPolicy.exchangeLine.quantity,
                quantityUnit: template.settlementPolicy.quantityUnit,
                payableImpactAmount: template.effectPolicy.payableAmount ?? {amount: 0, currency: request.subject.currency},
                settlementPayloadSnapshot: mergeSettlementPayload(template.settlementPayload, line?.settlementPayload),
            },
        ]
    }

    if (template.effectPolicy.kind === 'serviceEntitlement') {
        return [
            {
                settlementLineId: `settle-${input.applicationId}`,
                benefitRef,
                lineType: template.settlementPolicy.settlementLineType,
                quantity: template.effectPolicy.times,
                quantityUnit: template.settlementPolicy.quantityUnit,
                payableImpactAmount: {amount: 0, currency: request.subject.currency},
                settlementPayloadSnapshot: mergeSettlementPayload(template.settlementPayload, line?.settlementPayload),
            },
        ]
    }

    return []
}

function findReservationConflict(request: BenefitEvaluationRequest, benefitRef: BenefitRef) {
    return request.benefitSnapshot.reservations.find((reservation) => {
        if (reservation.state === 'released' || reservation.state === 'expired' || reservation.state === 'consumed') {
            return false
        }
        if (reservation.contextRef.contextId === request.contextRef.contextId) {
            return false
        }
        return (
            reservation.benefitRef.templateKey === benefitRef.templateKey &&
            reservation.benefitRef.lineKey === benefitRef.lineKey
        )
    })
}

function findExhaustedQuotaBucket(
    template: BenefitTemplate,
    request: BenefitEvaluationRequest,
    benefitRef: BenefitRef,
): string | undefined {
    const quotaBucket = template.reservationPolicy.quotaBucket
    if (!quotaBucket) {
        return undefined
    }
    const subjectRef = resolveReservationSubjectRefFromRequest(template, request, benefitRef)
    const usedQuantity = (request.benefitSnapshot.quotaFacts ?? [])
        .filter((fact) => fact.bucketKey === quotaBucket.bucketKey)
        .filter((fact) => quotaBucket.factSources.includes(fact.source))
        .filter((fact) => !subjectRef || subjectRefMatches(fact.subjectRef, subjectRef))
        .reduce((sum, fact) => sum + fact.usedQuantity, 0)

    return usedQuantity >= quotaBucket.limitQuantity
        ? quotaBucket.bucketKey
        : undefined
}

function resolveRemainingPayable(
    request: BenefitEvaluationRequest,
    completedSettlements: ReturnType<typeof resolveCompletedSettlements>,
): Money {
    const completedImpact = completedSettlements
        .filter((settlement) => settlement.status === 'completed' || settlement.status === 'partiallyRefunded')
        .reduce((sum, settlement) => sum + settlement.payableImpactAmount.amount, 0)

    return {
        amount: Math.max(0, request.subject.totals.payableAmount.amount - completedImpact),
        currency: request.subject.totals.payableAmount.currency,
    }
}

function resolveStacking(
    applications: BenefitApplication[],
    diagnostics: BenefitEvaluationDiagnostic[],
    templates: BenefitTemplate[],
): BenefitApplication[] {
    const templateByKey = new Map(templates.map((template) => [template.templateKey, template]))
    const winnersByGroup = new Map<string, BenefitApplication>()
    const resolved: BenefitApplication[] = []

    for (const application of applications) {
        const template = templateByKey.get(application.benefitRef.templateKey)
        const groupKey = template?.stackingPolicy.groupKey
        const isExclusive = template?.stackingPolicy.stackMode === 'exclusive'
        if (!template || !groupKey || !isExclusive) {
            resolved.push(application)
            continue
        }

        const current = winnersByGroup.get(groupKey)
        if (!current) {
            winnersByGroup.set(groupKey, application)
            resolved.push(application)
            continue
        }

        const currentTemplate = templateByKey.get(current.benefitRef.templateKey)
        const currentPriority = currentTemplate?.stackingPolicy.priority ?? 0
        const nextPriority = template.stackingPolicy.priority
        if (nextPriority > currentPriority) {
            diagnostics.push({
                diagnosticId: `diag-stacking-${current.benefitRef.templateKey}`,
                level: 'info',
                code: 'stackingConflict',
                benefitRef: current.benefitRef,
                message: `Exclusive group ${groupKey} kept ${application.benefitRef.templateKey}.`,
            })
            const index = resolved.indexOf(current)
            if (index >= 0) {
                resolved.splice(index, 1, application)
            }
            winnersByGroup.set(groupKey, application)
        } else {
            diagnostics.push({
                diagnosticId: `diag-stacking-${application.benefitRef.templateKey}`,
                level: 'info',
                code: 'stackingConflict',
                benefitRef: application.benefitRef,
                message: `Exclusive group ${groupKey} kept ${current.benefitRef.templateKey}.`,
            })
        }
    }

    return resolved
}

function buildAutoPricingApplication(input: {
    request: BenefitEvaluationRequest
    template: BenefitTemplate
    benefitRef: BenefitRef
    opportunity: BenefitOpportunity
    eligibleLines: CommerceLineSnapshot[]
}): {
    application: BenefitApplication
    allocations: BenefitAllocation[]
    pricingAdjustment: PricingAdjustment
    priceLayers: CommerceLinePriceLayer[]
} | undefined {
    const pricing = resolvePricingEffect(input.template, input.eligibleLines, input.request)
    if (!pricing || pricing.amount.amount <= 0) {
        return undefined
    }

    const applicationId = `app-${input.opportunity.opportunityId}`
    const allocations = allocateByAmount({
        benefitRef: input.benefitRef,
        applicationId,
        amount: pricing.amount,
        lines: pricing.targetLines,
    })
    const priceLayers = buildPriceLayers({
        request: input.request,
        benefitRef: input.benefitRef,
        applicationId,
        priceEffect: pricing.priceEffect,
        allocations,
        targetLines: pricing.targetLines,
    })

    return {
        application: {
            applicationId,
            opportunityId: input.opportunity.opportunityId,
            benefitRef: input.benefitRef,
            state: 'autoApplied',
            selectedQuantity: 1,
            actualEffect: {
                kind: 'pricingAdjustment',
                amount: pricing.amount,
                targetLineIds: pricing.targetLines.map((line) => line.lineId),
            },
            allocations,
        },
        allocations,
        priceLayers,
        pricingAdjustment: {
            adjustmentId: `adj-${applicationId}`,
            benefitRef: input.benefitRef,
            amount: pricing.amount,
            targetLineIds: pricing.targetLines.map((line) => line.lineId),
            allocationIds: allocations.map((allocation) => allocation.allocationId),
            priceLayerIds: priceLayers.map((layer) => layer.layerId),
            priceEffect: pricing.priceEffect,
            affectsOrderPayable: true,
        },
    }
}

function buildPriceLayers(input: {
    request: BenefitEvaluationRequest
    benefitRef: BenefitRef
    applicationId: string
    priceEffect: PricingAdjustment['priceEffect']
    allocations: BenefitAllocation[]
    targetLines: CommerceLineSnapshot[]
}): CommerceLinePriceLayer[] {
    const allocationByLineId = new Map(input.allocations.map((allocation) => [allocation.targetLineId, allocation]))
    const layers: CommerceLinePriceLayer[] = []

    input.targetLines.forEach((line, index) => {
        const allocation = allocationByLineId.get(line.lineId)
        if (!allocation || allocation.allocatedAmount.amount <= 0) {
            return
        }

        const lineAmountAfter = {
            amount: Math.max(0, line.currentLineAmount.amount - allocation.allocatedAmount.amount),
            currency: line.currentLineAmount.currency,
        }
        const unitPriceAfter = {
            amount: Math.max(0, Math.floor(lineAmountAfter.amount / Math.max(1, line.quantity))),
            currency: line.currentUnitPrice.currency,
        }

        layers.push({
            layerId: `layer-${input.applicationId}-${line.lineId}-${index}`,
            source: priceLayerSource(input.priceEffect),
            benefitRef: input.benefitRef,
            applicationId: input.applicationId,
            unitPriceBefore: line.currentUnitPrice,
            unitPriceAfter,
            lineAmountBefore: line.currentLineAmount,
            lineAmountAfter,
            adjustmentAmount: allocation.allocatedAmount,
            sequence: (line.priceLayers?.length ?? 0) + index + 1,
        })
    })

    return layers
}

function priceLayerSource(priceEffect: PricingAdjustment['priceEffect']): CommerceLinePriceLayer['source'] {
    if (priceEffect === 'memberPrice') {
        return 'memberPrice'
    }
    if (priceEffect === 'bundlePrice') {
        return 'bundlePrice'
    }
    return 'pricingBenefit'
}

function resolvePricingEffect(
    template: BenefitTemplate,
    eligibleLines: CommerceLineSnapshot[],
    request: BenefitEvaluationRequest,
):
    | {
          amount: Money
          targetLines: CommerceLineSnapshot[]
          priceEffect: PricingAdjustment['priceEffect']
      }
    | undefined {
    switch (template.effectPolicy.kind) {
        case 'amountOff':
            return {
                amount: capMoney(template.effectPolicy.amount, sumLineAmount(eligibleLines, 'current')),
                targetLines: eligibleLines,
                priceEffect: 'amountOff',
            }
        case 'ratioOff': {
            const currentAmount = sumLineAmount(eligibleLines, 'current')
            return {
                amount: capMoney(
                    {
                        amount: Math.floor(currentAmount.amount * template.effectPolicy.discountRatio),
                        currency: currentAmount.currency,
                    },
                    currentAmount,
                ),
                targetLines: eligibleLines,
                priceEffect: 'ratioOff',
            }
        }
        case 'fixedPrice': {
            const policy = template.effectPolicy
            const targetLines = filterLinesByProductScope(
                eligibleLines,
                policy.productScope,
            )
            const currentAmount = sumLineAmount(targetLines, 'current')
            return {
                amount: {
                    amount: Math.max(
                        0,
                        currentAmount.amount - targetLines.reduce(
                            (sum, line) => sum + policy.fixedUnitPrice.amount * line.quantity,
                            0,
                        ),
                    ),
                    currency: currentAmount.currency,
                },
                targetLines,
                priceEffect: policy.priceEffect ?? 'fixedPrice',
            }
        }
        case 'buyNFreeM': {
            const policy = template.effectPolicy
            const totalQuantity = eligibleLines.reduce((sum, line) => sum + line.quantity, 0)
            if (totalQuantity < policy.buyQuantity) {
                return undefined
            }
            const sorted = [...eligibleLines].sort((left, right) =>
                policy.freeTarget === 'highestPrice'
                    ? right.currentUnitPrice.amount - left.currentUnitPrice.amount
                    : left.currentUnitPrice.amount - right.currentUnitPrice.amount,
            )
            const targetLines = sorted.slice(0, policy.freeQuantity)
            return {
                amount: {
                    amount: targetLines.reduce((sum, line) => sum + line.currentUnitPrice.amount, 0),
                    currency: request.subject.currency,
                },
                targetLines,
                priceEffect: 'buyNFreeM',
            }
        }
        case 'nthItemDiscount': {
            const ordered = orderLinesForNthItem(eligibleLines, template.effectPolicy.sortOrder)
            const targetLine = ordered[template.effectPolicy.n - 1]
            if (!targetLine) {
                return undefined
            }
            const amount = template.effectPolicy.discountAmount?.amount
                ?? Math.floor(targetLine.currentUnitPrice.amount * (template.effectPolicy.discountRatio ?? 0))
            return {
                amount: {amount, currency: request.subject.currency},
                targetLines: [targetLine],
                priceEffect: 'nthItemDiscount',
            }
        }
        case 'tieredDiscount': {
            const currentAmount = sumLineAmount(eligibleLines, 'current')
            const matched = template.effectPolicy.tiers.filter((tier) => {
                if (!tier.threshold.amount) {
                    return false
                }
                return compareAmount(currentAmount.amount, tier.threshold.operator, tier.threshold.amount.amount)
            })
            const tier = template.effectPolicy.tierSelection === 'firstMatched' ? matched[0] : matched.at(-1)
            if (!tier) {
                return undefined
            }
            if (tier.effect.kind === 'amountOff') {
                return {
                    amount: capMoney(tier.effect.amount, currentAmount),
                    targetLines: eligibleLines,
                    priceEffect: 'amountOff',
                }
            }
            if (tier.effect.kind === 'ratioOff') {
                return {
                    amount: {
                        amount: Math.floor(currentAmount.amount * tier.effect.discountRatio),
                        currency: currentAmount.currency,
                    },
                    targetLines: eligibleLines,
                    priceEffect: 'ratioOff',
                }
            }
            return {
                amount: {
                    amount: Math.max(0, currentAmount.amount - tier.effect.fixedUnitPrice.amount * eligibleLines.length),
                    currency: currentAmount.currency,
                },
                targetLines: eligibleLines,
                priceEffect: 'fixedPrice',
            }
        }
        case 'bundlePrice': {
            const targetLines = template.effectPolicy.bundleSlots.map((slot) =>
                eligibleLines.find((line) => lineMatchesScope(line, slot.productScope)),
            )
            if (targetLines.some((line) => !line)) {
                return undefined
            }
            const lines = targetLines as CommerceLineSnapshot[]
            const current = sumLineAmount(lines, 'current')
            return {
                amount: {
                    amount: Math.max(0, current.amount - template.effectPolicy.bundlePrice.amount),
                    currency: current.currency,
                },
                targetLines: lines,
                priceEffect: 'bundlePrice',
            }
        }
        default:
            return undefined
    }
}

function orderLinesForNthItem(
    lines: CommerceLineSnapshot[],
    sortOrder: 'byPriceAsc' | 'byPriceDesc' | 'byCartOrder',
): CommerceLineSnapshot[] {
    if (sortOrder === 'byCartOrder') {
        return lines
    }

    return [...lines].sort((left, right) =>
        sortOrder === 'byPriceAsc'
            ? left.currentUnitPrice.amount - right.currentUnitPrice.amount
            : right.currentUnitPrice.amount - left.currentUnitPrice.amount,
    )
}

function lineMatchesScope(line: CommerceLineSnapshot, scope: ProductScopeRule): boolean {
    if (scope.mode === 'all') {
        return true
    }

    const matched =
        scope.identityMatchers?.some((matcher) => lineMatchesIdentityMatcher(line, matcher)) ?? false

    return scope.mode === 'include' ? matched : !matched
}

function lineMatchesIdentityMatcher(line: CommerceLineSnapshot, matcher: ProductIdentityMatcher): boolean {
    if (line.productIdentities.some(
        (identity) =>
            identity.identityType === matcher.identityType &&
            matcher.values.includes(identity.identityValue) &&
            (!matcher.ownerScope || matcher.ownerScope === identity.ownerScope),
    )) {
        return true
    }

    if (matcher.identityType === 'categoryId') {
        return line.categoryPath?.some(
            (category) =>
                matcher.values.includes(category.categoryId) &&
                (!matcher.ownerScope || matcher.ownerScope === category.ownerScope),
        ) ?? false
    }

    if (matcher.identityType === 'saleProductType') {
        return Boolean(line.saleProductTypeCode && matcher.values.includes(line.saleProductTypeCode))
    }

    return false
}

function buildSelectedFulfillmentEffects(input: {
    request: BenefitEvaluationRequest
    template: BenefitTemplate
    benefitRef: BenefitRef
    eligibleLines: CommerceLineSnapshot[]
    line?: BenefitLine
}): FulfillmentEffect[] {
    if (input.template.effectPolicy.kind === 'exchangeLine') {
        return [
            {
                fulfillmentEffectId: `fulfill-${buildOpportunityId(input.benefitRef)}`,
                benefitRef: input.benefitRef,
                effectType: 'exchangeLine',
                selectedLines: [
                    {
                        fulfillmentLineId: input.template.effectPolicy.exchangeLine.candidateLineId,
                        quantity: input.template.effectPolicy.exchangeLine.quantity,
                        displayName: input.template.effectPolicy.exchangeLine.displayName,
                        lineAmount: input.template.effectPolicy.payableAmount,
                    },
                ],
            },
        ]
    }

    if (input.template.effectPolicy.kind === 'serviceEntitlement') {
        return [
            {
                fulfillmentEffectId: `fulfill-${buildOpportunityId(input.benefitRef)}`,
                benefitRef: input.benefitRef,
                effectType: 'serviceLine',
                selectedLines: [
                    {
                        fulfillmentLineId: input.template.effectPolicy.serviceCode,
                        quantity: input.template.effectPolicy.times,
                        displayName: input.template.effectPolicy.displayName,
                    },
                ],
            },
        ]
    }

    return []
}

function mergeSettlementPayload(
    templatePayload: BenefitTemplate['settlementPayload'],
    linePayload: BenefitLine['settlementPayload'],
): BenefitLine['settlementPayload'] {
    if (!templatePayload && !linePayload) {
        return undefined
    }

    return {
        ...templatePayload,
        ...linePayload,
        metadata: {
            ...templatePayload?.metadata,
            ...linePayload?.metadata,
        },
    }
}

function resolvePaymentDiscountAmount(template: BenefitTemplate, coverageAmount: Money): Money {
    if (template.effectPolicy.kind !== 'paymentMethodDiscount') {
        return {amount: 0, currency: coverageAmount.currency}
    }

    const discountByRatio =
        template.effectPolicy.discountRatio === undefined
            ? 0
            : Math.floor(coverageAmount.amount * template.effectPolicy.discountRatio)
    const discountByAmount = template.effectPolicy.discountAmount?.amount ?? 0
    const rawAmount = Math.max(discountByRatio, discountByAmount)
    const capped = template.effectPolicy.maxDiscountAmount
        ? Math.min(rawAmount, template.effectPolicy.maxDiscountAmount.amount)
        : rawAmount

    return {
        amount: Math.min(capped, coverageAmount.amount),
        currency: coverageAmount.currency,
    }
}
