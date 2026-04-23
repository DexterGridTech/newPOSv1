export type CateringProductTopic =
    | 'catering.product.profile'
    | 'catering.brand-menu.profile'
    | 'menu.catalog'
    | 'catering.price-rule.profile'
    | 'catering.bundle-price-rule.profile'

export interface CateringProductEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> {
    schema_version: 1
    projection_kind: 'catering_product'
    sandbox_id: string
    platform_id: string
    source_service: string
    source_event_id: string
    source_revision: number
    generated_at: string
    data: TData
}

export interface CateringProductProfile {
    product_id: string
    brand_id?: string
    store_id?: string
    product_name?: string
    ownership_scope?: string
    product_type?: string
    base_price?: number
    production_steps?: Array<Record<string, unknown>>
    modifier_groups?: Array<Record<string, unknown>>
    variants?: Array<Record<string, unknown>>
    combo_item_groups?: Array<Record<string, unknown>>
    price_rules?: Array<Record<string, unknown>>
    bundle_price_rules?: Array<Record<string, unknown>>
    status?: string
    [key: string]: unknown
}

export interface CateringBrandMenuProfile {
    brand_menu_id: string
    brand_id?: string
    menu_name?: string
    status?: string
    sections?: Array<Record<string, unknown>>
    [key: string]: unknown
}

export interface TerminalMenuCatalog {
    menu_id: string
    store_id?: string
    menu_name?: string
    sections?: Array<{
        section_id: string
        section_name?: string
        display_order?: number
        products?: Array<Record<string, unknown>>
        [key: string]: unknown
    }>
    version_hash?: string
    [key: string]: unknown
}

export interface CateringPriceRuleProfile {
    rule_id: string
    product_id?: string
    bundle_id?: string
    store_id?: string
    price_type?: string
    channel_type?: string
    [key: string]: unknown
}

export interface CateringProductRecord<TData extends Record<string, unknown> = Record<string, unknown>> {
    topic: CateringProductTopic
    itemKey: string
    scopeType: string
    scopeId: string
    revision: number
    sourceReleaseId?: string | null
    sourceEventId?: string
    sourceRevision?: number
    occurredAt?: string
    updatedAt: number
    envelope: CateringProductEnvelope<TData>
    data: TData
    tombstone?: boolean
}

export interface CateringProductDiagnosticsEntry {
    topic: string
    itemKey: string
    scopeType?: string
    scopeId?: string
    revision?: number
    reason: string
    occurredAt: number
}

export interface CateringProductMasterDataState {
    byTopic: Partial<Record<CateringProductTopic, Record<string, CateringProductRecord>>>
    diagnostics: CateringProductDiagnosticsEntry[]
    lastChangedAt?: number
}

export interface EffectiveMenuSectionView {
    sectionId: string
    sectionName: string
    displayOrder: number
    products: Array<{
        productId: string
        displayOrder: number
        title: string
        price?: number
        productType?: string
    }>
}

export interface EffectiveMenuView {
    menuId: string
    menuName: string
    storeId?: string
    versionHash?: string
    sections: EffectiveMenuSectionView[]
}
