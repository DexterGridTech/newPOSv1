import type {Money} from '../foundations/money'

export interface GroupLimitPolicy {
    quantity?: number
    amount?: Money
}

export interface StackingPolicy {
    priority: number
    groupKey?: string
    exclusionGroupKeys?: string[]
    stackMode: 'exclusive' | 'stackable' | 'bestOfGroup' | 'sequential'
    groupLimit?: GroupLimitPolicy
    thresholdGroupKey?: string
}

export interface BenefitStackingSelector {
    templateKeys?: string[]
    lineTypes?: string[]
    effectKinds?: string[]
    groupKeys?: string[]
    settlementLineTypes?: string[]
}

export interface TransactionStackingRule {
    ruleId: string
    left: BenefitStackingSelector
    right: BenefitStackingSelector
    relation: 'shareable' | 'exclusive'
    dimension: 'order' | 'commerceLine' | 'paymentGroup'
    priority: number
    source: 'global' | 'template' | 'store' | 'runtime'
}

export interface TransactionStackingPolicy {
    defaultRelation: 'exclusive' | 'shareable'
    rules: TransactionStackingRule[]
    conflictResolution: 'priority' | 'bestBenefit' | 'manualSelectionRequired'
}
