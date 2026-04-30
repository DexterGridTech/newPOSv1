import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
    type ActorExecutionContext,
} from '@next/kernel-base-runtime-shell-v2'
import {tdpSyncV2CommandDefinitions} from '@next/kernel-base-tdp-sync-runtime-v2'
import {
    evaluateBenefitRequest,
    resolveReservationSubjectRef,
} from '@next/kernel-business-benefit-calculation'
import type {
    BenefitApplicationInput,
    BenefitEvaluationResult,
    BenefitEvaluationRequest,
    BenefitLine,
    BenefitRef,
    BenefitReservation,
    BenefitTemplate,
    CustomerIdentitySnapshot,
} from '@next/kernel-business-benefit-types'
import {moduleName} from '../../moduleName'
import {decodeBenefitProjectionChange} from '../../foundations/decoder'
import {toBenefitContextKey, toBenefitRefKey} from '../../foundations/contextKey'
import {benefitSessionTopics, isBenefitSessionTopic} from '../../foundations/topics'
import {
    mergeBenefitSnapshots,
    selectBenefitContextView,
    selectBenefitIdentitySnapshotForContext,
    selectBenefitSnapshotForContext,
} from '../../selectors'
import type {
    BenefitSessionDiagnosticEntry,
    BenefitCenterPortRef,
    BenefitEvaluationState,
    BenefitIdentityState,
    BenefitReservationState,
    BenefitSnapshotState,
    CreateBenefitSessionModuleInput,
    EvaluateBenefitContextPayload,
} from '../../types'
import {benefitSessionCommandDefinitions} from '../commands'
import {
    BENEFIT_EVALUATION_STATE_KEY,
    BENEFIT_IDENTITY_STATE_KEY,
    BENEFIT_RESERVATION_STATE_KEY,
    BENEFIT_SNAPSHOT_STATE_KEY,
    benefitEvaluationActions,
    benefitIdentityActions,
    benefitReservationActions,
    benefitSnapshotActions,
} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

type BenefitSessionModuleStateView = {
    [BENEFIT_IDENTITY_STATE_KEY]?: BenefitIdentityState
    [BENEFIT_SNAPSHOT_STATE_KEY]?: BenefitSnapshotState
    [BENEFIT_RESERVATION_STATE_KEY]?: BenefitReservationState
    [BENEFIT_EVALUATION_STATE_KEY]?: BenefitEvaluationState
}

const getBenefitSessionState = (
    context: ActorExecutionContext,
): BenefitSessionModuleStateView => context.getState() as BenefitSessionModuleStateView

const entryIdentityKey = (entryIdentity: {identityType: string; identityValue: string}): string =>
    `${entryIdentity.identityType}:${entryIdentity.identityValue}`

const stableStringify = (value: unknown): string =>
    JSON.stringify(value, (_key, item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return item
        }
        return Object.keys(item as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((result, key) => {
                result[key] = (item as Record<string, unknown>)[key]
                return result
            }, {})
    })

const getBenefitCenterPort = (benefitCenterPortRef: BenefitCenterPortRef) => {
    if (!benefitCenterPortRef.current) {
        throw new Error('BENEFIT_SESSION_BENEFIT_CENTER_PORT_NOT_CONFIGURED')
    }
    return benefitCenterPortRef.current
}

const nowIso = () => new Date().toISOString()

const createLocalReservation = (
    input: Parameters<NonNullable<BenefitCenterPortRef['current']>['reserveBenefit']>[0],
): BenefitReservation => ({
    reservationId: `local-${input.idempotencyKey}`,
    benefitRef: input.benefitRef,
    subjectRef: input.subjectRef,
    contextRef: input.contextRef,
    quantity: input.quantity,
    amount: input.amount,
    state: input.contextRef.contextType === 'payment' ? 'held_by_payment' : 'held_by_cart',
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.ttlSeconds ? new Date(Date.now() + input.ttlSeconds * 1000).toISOString() : undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
})

const findTemplate = (
    templates: BenefitTemplate[],
    benefitRef: BenefitRef,
): BenefitTemplate | undefined =>
    templates.find(template => template.templateKey === benefitRef.templateKey)

const findBenefitLine = (
    lines: BenefitLine[],
    benefitRef: BenefitRef,
): BenefitLine | undefined =>
    benefitRef.lineKey ? lines.find(line => line.lineKey === benefitRef.lineKey) : undefined

const shouldAutoReserve = (
    template: BenefitTemplate | undefined,
) => template?.reservationPolicy.mode === 'autoOnOpportunity'

const activeReservationExists = (
    reservations: BenefitReservation[],
    benefitRef: BenefitRef,
    contextKey: string,
) => reservations.some((reservation) => {
    if (toBenefitRefKey(reservation.benefitRef) !== toBenefitRefKey(benefitRef)) {
        return false
    }
    if (toBenefitContextKey(reservation.contextRef) !== contextKey) {
        return false
    }
    return reservation.state !== 'released'
        && reservation.state !== 'expired'
        && reservation.state !== 'consumed'
})

const reserveAutoOpportunities = async (
    context: ActorExecutionContext,
    benefitCenterPortRef: BenefitCenterPortRef,
    payload: EvaluateBenefitContextPayload,
    request: BenefitEvaluationRequest,
    result: ReturnType<typeof evaluateBenefitRequest>,
) => {
    const contextKey = toBenefitContextKey(payload.contextRef)
    const snapshot = request.benefitSnapshot
    const reservations: BenefitReservation[] = []

    // 自动占用发生在“机会已经算出来且可用”之后。
    // 黑金会员每天一次 8 折：购物车 A 占用后，购物车 B 会因同一 membership 被占用而不可用。
    for (const opportunity of result.opportunities) {
        if (opportunity.availability !== 'available') {
            continue
        }
        const template = findTemplate(snapshot.templates, opportunity.benefitRef)
        if (!shouldAutoReserve(template)) {
            continue
        }
        if (activeReservationExists(snapshot.reservations, opportunity.benefitRef, contextKey)) {
            continue
        }
        const subjectRef = resolveReservationSubjectRef({
            template: template!,
            benefitRef: opportunity.benefitRef,
            identitySnapshot: request.identitySnapshot,
            paymentInstrument: payload.subject.paymentInstrument,
        }) ?? {
            subjectType: 'custom',
            subjectKey: toBenefitRefKey(opportunity.benefitRef),
        }
        const quantity = template?.selectionPolicy.defaultSelectedQuantity ?? 1
        const idempotencyKey = `auto:${contextKey}:${toBenefitRefKey(opportunity.benefitRef)}`
        const reserveInput = {
            contextRef: payload.contextRef,
            benefitRef: opportunity.benefitRef,
            subjectRef,
            quantity,
            amount: opportunity.maxEffectPreview?.estimatedAmount,
            idempotencyKey,
            ttlSeconds: template?.reservationPolicy.ttlSeconds,
        }
        const reservation = benefitCenterPortRef.current
            ? await benefitCenterPortRef.current.reserveBenefit(reserveInput)
            : createLocalReservation(reserveInput)
        reservations.push(reservation)
    }

    if (reservations.length > 0) {
        context.dispatchAction(benefitReservationActions.upsertReservations({
            reservations,
            changedAt: Date.now(),
        }))
    }
}

const buildEvaluationRequest = (
    context: ActorExecutionContext,
    payload: EvaluateBenefitContextPayload,
): {
    request: BenefitEvaluationRequest
    selectedApplications: BenefitApplicationInput[]
    inputFingerprint: string
} => {
    const state = getBenefitSessionState(context)
    const contextKey = toBenefitContextKey(payload.contextRef)
    const view = selectBenefitContextView(state, payload.contextRef)
    // 数据优先级：命令显式传入 > session 已缓存 > TDP/个人/动态码快照合并。
    // 业务包只提供标准交易 subject，不需要知道权益来自哪个系统。
    const identitySnapshot = payload.identitySnapshot
        ?? view.identitySnapshot
        ?? selectBenefitIdentitySnapshotForContext(state, payload.contextRef)
    const selectedApplications = payload.selectedApplications
        ?? view.selectedApplications
    const baseSnapshot = selectBenefitSnapshotForContext(state, payload.contextRef)
    const benefitSnapshot = mergeBenefitSnapshots([
        baseSnapshot,
        payload.benefitSnapshot,
        {
            templates: [],
            lines: [],
            reservations: Object.values(baseSnapshot.reservations ?? {}),
        },
    ])
    const request: BenefitEvaluationRequest = {
        contextRef: payload.contextRef,
        stage: payload.stage,
        subject: payload.subject,
        identitySnapshot,
        benefitSnapshot,
        selectedApplications,
    }
    const inputFingerprint = stableStringify({
        contextKey,
        stage: payload.stage,
        subject: payload.subject,
        identitySnapshot,
        benefitSnapshot,
        selectedApplications,
    })
    return {
        request,
        selectedApplications,
        inputFingerprint,
    }
}

const evaluateContext = async (
    context: ActorExecutionContext,
    benefitCenterPortRef: BenefitCenterPortRef,
    payload: EvaluateBenefitContextPayload,
    calculator: NonNullable<CreateBenefitSessionModuleInput['calculator']>,
) => {
    const contextKey = toBenefitContextKey(payload.contextRef)
    const changedAt = Date.now()
    if (payload.identitySnapshot) {
        context.dispatchAction(benefitIdentityActions.upsertIdentitySnapshot({
            contextKey,
            entryKey: entryIdentityKey(payload.identitySnapshot.entryIdentity),
            snapshot: payload.identitySnapshot,
            changedAt,
        }))
    }

    const state = getBenefitSessionState(context)
    const current = selectBenefitContextView(state, payload.contextRef)
    const built = buildEvaluationRequest(context, payload)
    // 购物车高频变化会高频计算；输入指纹不变时复用结果。
    // 身份、权益快照、选择项、商品金额或支付事实变化都会让 stale/指纹失效。
    if (current.result && !current.stale && current.result.contextRef.contextId === payload.contextRef.contextId) {
        const previousEvaluationState = state[BENEFIT_EVALUATION_STATE_KEY]?.byContextKey?.[contextKey]
        if (previousEvaluationState?.result && previousEvaluationState.inputFingerprint === built.inputFingerprint) {
            return {
                cached: true,
                contextId: payload.contextRef.contextId,
                applicationCount: previousEvaluationState.result.applications.length,
                opportunityCount: previousEvaluationState.result.opportunities.length,
            }
        }
    }

    const result = calculator.evaluateBenefitRequest(built.request)

    context.dispatchAction(benefitEvaluationActions.replaceContextEvaluation({
        contextKey,
        changedAt,
        evaluation: {
            contextRef: payload.contextRef,
            stage: payload.stage,
            result,
            selectedApplications: built.selectedApplications,
            evaluatedAt: changedAt,
            stale: false,
            inputFingerprint: built.inputFingerprint,
        },
    }))

    await reserveAutoOpportunities(context, benefitCenterPortRef, payload, built.request, result)
    await context.dispatchCommand(createCommand(benefitSessionCommandDefinitions.benefitContextEvaluated, {
        contextKey,
        resultApplicationCount: result.applications.length,
        reservationCount: result.applications.filter(item => item.state === 'reserved').length,
        evaluatedAt: changedAt,
    }))

    return {
        cached: false,
        contextId: payload.contextRef.contextId,
        applicationCount: result.applications.length,
        opportunityCount: result.opportunities.length,
        settlementLineCount: result.settlementLines.length,
    }
}

const selectOpportunityAsApplication = (
    context: ActorExecutionContext,
    payload: {
        contextRef: EvaluateBenefitContextPayload['contextRef']
        opportunityId: string
        selectedQuantity?: number
        input?: BenefitApplicationInput['input']
    },
) => {
    const state = getBenefitSessionState(context)
    const contextKey = toBenefitContextKey(payload.contextRef)
    const view = selectBenefitContextView(state, payload.contextRef)
    const opportunity = view.result?.opportunities.find(item => item.opportunityId === payload.opportunityId)
    if (!opportunity) {
        throw new Error('BENEFIT_OPPORTUNITY_NOT_FOUND')
    }
    const selectedApplications = [
        ...view.selectedApplications.filter(item => toBenefitRefKey(item.benefitRef) !== toBenefitRefKey(opportunity.benefitRef)),
        {
            benefitRef: opportunity.benefitRef,
            selectedQuantity: payload.selectedQuantity,
            input: payload.input,
        },
    ]
    context.dispatchAction(benefitEvaluationActions.setSelectedApplications({
        contextKey,
        selectedApplications,
        changedAt: Date.now(),
    }))
    return {
        selectedApplications,
        stale: true,
    }
}

export const createBenefitSessionActorDefinition = (
    benefitCenterPortRef: BenefitCenterPortRef,
    calculator: NonNullable<CreateBenefitSessionModuleInput['calculator']>,
): ActorDefinition => defineActor('BenefitSessionActor', [
    onCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, context => {
        const payload = context.command.payload
        if (!isBenefitSessionTopic(payload.topic)) {
            return {accepted: false}
        }

        const templates: BenefitTemplate[] = []
        const removedTemplateKeys: string[] = []
        const lines: BenefitLine[] = []
        const removedLineKeys: string[] = []
        const diagnostics: BenefitSessionDiagnosticEntry[] = []
        const changedAt = Date.now()

        payload.changes.forEach((change) => {
            const decoded = decodeBenefitProjectionChange(payload.topic, change)
            if (!decoded.record) {
                diagnostics.push({
                    diagnosticId: `diag-benefit-tdp-${payload.topic}-${change.itemKey}`,
                    level: 'warn' as const,
                    code: 'benefitProjectionDecodeFailed',
                    message: decoded.error,
                    occurredAt: changedAt,
                })
                return
            }
            if (decoded.record.tombstone) {
                if (payload.topic === benefitSessionTopics.templateProfile) {
                    removedTemplateKeys.push(decoded.record.itemKey)
                } else {
                    removedLineKeys.push(decoded.record.itemKey)
                }
                return
            }
            if (payload.topic === benefitSessionTopics.templateProfile) {
                templates.push(decoded.record.data as unknown as BenefitTemplate)
                return
            }
            lines.push(decoded.record.data as unknown as BenefitLine)
        })

        if (templates.length > 0) {
            context.dispatchAction(benefitSnapshotActions.upsertTdpTemplates({templates, changedAt}))
        }
        removedTemplateKeys.forEach(templateKey => {
            context.dispatchAction(benefitSnapshotActions.removeTdpTemplate({templateKey, changedAt}))
        })
        if (lines.length > 0) {
            context.dispatchAction(benefitSnapshotActions.upsertTdpLines({lines, changedAt}))
        }
        removedLineKeys.forEach(lineKey => {
            context.dispatchAction(benefitSnapshotActions.removeTdpLine({lineKey, changedAt}))
        })
        if (diagnostics.length > 0) {
            context.dispatchAction(benefitSnapshotActions.addSnapshotDiagnostics({diagnostics, changedAt}))
        }
        if (templates.length > 0 || lines.length > 0 || removedTemplateKeys.length > 0 || removedLineKeys.length > 0) {
            context.dispatchAction(benefitEvaluationActions.markAllEvaluationsStale({changedAt}))
        }

        return {
            accepted: true,
            templates: templates.length,
            lines: lines.length,
            diagnostics: diagnostics.length,
        }
    }),
    onCommand(benefitSessionCommandDefinitions.linkBenefitIdentity, async context => {
        const payload = context.command.payload
        const benefitCenterPort = getBenefitCenterPort(benefitCenterPortRef)
        // 终端只传入口身份和 terminalNo。后台按组织树查询商场/品牌/门店权益系统，
        // 再包装成统一身份快照和权益快照返回。
        const response = await benefitCenterPort.queryPersonalBenefits({
            terminalNo: payload.terminalNo,
            entryIdentity: payload.entryIdentity,
            contextRef: payload.contextRef,
        })
        const changedAt = Date.now()
        const contextKey = toBenefitContextKey(payload.contextRef)
        const entryKey = entryIdentityKey(response.identitySnapshot.entryIdentity)
        context.dispatchAction(benefitIdentityActions.upsertIdentitySnapshot({
            contextKey,
            entryKey,
            snapshot: response.identitySnapshot,
            changedAt,
        }))
        context.dispatchAction(benefitSnapshotActions.upsertPersonalSnapshot({
            entryKey,
            snapshot: response.benefitSnapshot,
            changedAt,
        }))
        if (response.benefitSnapshot.reservations.length > 0) {
            context.dispatchAction(benefitReservationActions.upsertReservations({
                reservations: response.benefitSnapshot.reservations,
                changedAt,
            }))
        }
        context.dispatchAction(benefitEvaluationActions.markAllEvaluationsStale({changedAt}))
        return {
            entryKey,
            identityCount: response.identitySnapshot.identities.length,
            templateCount: response.benefitSnapshot.templates.length,
            lineCount: response.benefitSnapshot.lines.length,
        }
    }),
    onCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, async context =>
        evaluateContext(context as ActorExecutionContext, benefitCenterPortRef, context.command.payload, calculator),
    ),
    onCommand(benefitSessionCommandDefinitions.selectBenefitOpportunity, context =>
        selectOpportunityAsApplication(context as ActorExecutionContext, context.command.payload),
    ),
    onCommand(benefitSessionCommandDefinitions.chooseBenefitGift, context =>
        selectOpportunityAsApplication(context as ActorExecutionContext, {
            ...context.command.payload,
            input: {
                giftLineIds: context.command.payload.giftLineIds,
            },
        }),
    ),
    onCommand(benefitSessionCommandDefinitions.deselectBenefitApplication, context => {
        const payload = context.command.payload
        const state = getBenefitSessionState(context as ActorExecutionContext)
        const contextKey = toBenefitContextKey(payload.contextRef)
        const view = selectBenefitContextView(state, payload.contextRef)
        const application = view.result?.applications.find(item => item.applicationId === payload.applicationId)
        const selectedApplications = application
            ? view.selectedApplications.filter(item => toBenefitRefKey(item.benefitRef) !== toBenefitRefKey(application.benefitRef))
            : view.selectedApplications
        context.dispatchAction(benefitEvaluationActions.setSelectedApplications({
            contextKey,
            selectedApplications,
            changedAt: Date.now(),
        }))
        return {
            selectedApplications,
            stale: true,
            reason: payload.reason,
        }
    }),
    onCommand(benefitSessionCommandDefinitions.activateBenefitCode, async context => {
        const payload = context.command.payload
        const benefitCenterPort = getBenefitCenterPort(benefitCenterPortRef)
        // 动态码可能在购物车添加促销活动，也可能在订单/支付阶段扫码得到券。
        // 本包只把后台返回的模板/权益行挂到当前上下文，随后重新计算。
        const activation = await benefitCenterPort.activateBenefitCode(payload)
        const changedAt = Date.now()
        const contextKey = toBenefitContextKey(payload.contextRef)
        context.dispatchAction(benefitSnapshotActions.addActivatedCode({
            contextKey,
            activation,
            changedAt,
        }))
        context.dispatchAction(benefitEvaluationActions.markContextStale({contextKey, changedAt}))
        return {
            activationId: activation.activationId,
            templateCount: activation.activatedTemplates.length,
            lineCount: activation.activatedLines.length,
        }
    }),
    onCommand(benefitSessionCommandDefinitions.releaseBenefitContext, async context => {
        const payload = context.command.payload
        const state = getBenefitSessionState(context as ActorExecutionContext)
        const view = selectBenefitContextView(state, payload.contextRef)
        const changedAt = Date.now()
        const released: BenefitReservation[] = []
        // 挂单取消、支付超时、身份变化时必须释放占用，
        // 否则购物车 A 取消后仍会挡住购物车 B 的“每天一次”名额。
        if (benefitCenterPortRef.current) {
            for (const reservation of view.reservations) {
                if (reservation.state === 'released' || reservation.state === 'expired' || reservation.state === 'consumed') {
                    released.push(reservation)
                    continue
                }
                released.push(await benefitCenterPortRef.current.releaseBenefitReservation(reservation))
            }
            if (released.length > 0) {
                context.dispatchAction(benefitReservationActions.upsertReservations({
                    reservations: released,
                    changedAt,
                }))
            }
        } else {
            context.dispatchAction(benefitReservationActions.releaseContextReservations({
                contextKey: toBenefitContextKey(payload.contextRef),
                changedAt,
            }))
        }
        context.dispatchAction(benefitSnapshotActions.clearActivatedCodesForContext({
            contextKey: toBenefitContextKey(payload.contextRef),
            changedAt,
        }))
        context.dispatchAction(benefitEvaluationActions.removeContextEvaluation({
            contextKey: toBenefitContextKey(payload.contextRef),
            changedAt,
        }))
        context.dispatchAction(benefitEvaluationActions.markAllEvaluationsStale({changedAt}))
        return {
            releasedCount: released.length,
            reason: payload.reason,
        }
    }),
])
