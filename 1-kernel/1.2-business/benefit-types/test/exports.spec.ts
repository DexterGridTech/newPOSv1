import {describe, expect, it} from 'vitest'
import {
    moduleName,
    packageVersion,
    type BenefitApplication,
    type BenefitEvaluationRequest,
    type BenefitLine,
    type BenefitTemplate,
    type CommerceSubjectSnapshot,
    type Money,
    type SettlementLineCandidate,
} from '../src'

describe('@next/kernel-business-benefit-types public exports', () => {
    it('exports runtime package metadata', () => {
        expect(moduleName).toBe('kernel.business.benefit-types')
        expect(packageVersion).toBe('1.0.0')
    })

    it('allows consumers to import core types from the root entry', () => {
        const money: Money = {amount: 100, currency: 'CNY'}
        const template = null as unknown as BenefitTemplate
        const line = null as unknown as BenefitLine
        const subject = null as unknown as CommerceSubjectSnapshot
        const request = null as unknown as BenefitEvaluationRequest
        const application = null as unknown as BenefitApplication
        const settlementLine = null as unknown as SettlementLineCandidate

        expect(money.amount).toBe(100)
        expect(template).toBeNull()
        expect(line).toBeNull()
        expect(subject).toBeNull()
        expect(request).toBeNull()
        expect(application).toBeNull()
        expect(settlementLine).toBeNull()
    })
})
