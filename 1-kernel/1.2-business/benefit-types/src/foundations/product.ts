import type {Money} from './money'

export interface ProductIdentity {
    identityType: 'skuId' | 'spuId' | 'categoryId' | 'saleProductType' | string
    identityValue: string
    ownerScope?: string
}

export interface ProductIdentityMatcher {
    identityType: string
    values: string[]
    ownerScope?: string
}

export interface ProductScopeRule {
    mode: 'all' | 'include' | 'exclude'
    identityMatchers?: ProductIdentityMatcher[]
}

export interface ProductCategoryNode {
    categoryId: string
    categoryName?: string
    depth?: number
    ownerScope?: string
}

export interface QuantityRule {
    minQuantity?: number
    maxQuantity?: number
    multipleOf?: number
}

export interface ThresholdRequirement {
    thresholdType: 'amount' | 'quantity' | 'lineCount' | 'attribute'
    operator: 'gt' | 'gte' | 'eq' | 'lte' | 'lt'
    amount?: Money
    quantity?: number
    attributeKey?: string
    attributeValue?: unknown
}
