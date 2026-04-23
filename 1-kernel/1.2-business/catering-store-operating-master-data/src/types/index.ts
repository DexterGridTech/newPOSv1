export type CateringStoreOperatingTopic =
    | 'menu.availability'
    | 'catering.availability-rule.profile'
    | 'catering.saleable-stock.profile'
    | 'catering.stock-reservation.active'

export interface CateringStoreOperatingEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> {
    schema_version: 1
    projection_kind: 'catering_store_operation'
    sandbox_id: string
    platform_id: string
    source_service: string
    source_event_id: string
    source_revision: number
    generated_at: string
    data: TData
}

export interface MenuAvailabilityProfile {
    product_id: string
    store_id?: string
    available?: boolean
    sold_out_reason?: string | null
    effective_from?: string
    [key: string]: unknown
}

export interface AvailabilityRuleProfile {
    rule_id: string
    store_id?: string
    product_id?: string
    [key: string]: unknown
}

export interface SaleableStockProfile {
    stock_id: string
    store_id?: string
    product_id?: string
    saleable_quantity?: number
    safety_stock?: number
    status?: string
    [key: string]: unknown
}

export interface StockReservationProfile {
    reservation_id: string
    store_id?: string
    product_id?: string
    reserved_quantity?: number
    reservation_status?: string
    expires_at?: string
    [key: string]: unknown
}

export interface CateringStoreOperatingRecord<TData extends Record<string, unknown> = Record<string, unknown>> {
    topic: CateringStoreOperatingTopic
    itemKey: string
    scopeType: string
    scopeId: string
    revision: number
    sourceReleaseId?: string | null
    sourceEventId?: string
    sourceRevision?: number
    occurredAt?: string
    updatedAt: number
    envelope: CateringStoreOperatingEnvelope<TData>
    data: TData
    tombstone?: boolean
}

export interface CateringStoreOperatingDiagnosticsEntry {
    topic: string
    itemKey: string
    scopeType?: string
    scopeId?: string
    revision?: number
    reason: string
    occurredAt: number
}

export interface CateringStoreOperatingMasterDataState {
    byTopic: Partial<Record<CateringStoreOperatingTopic, Record<string, CateringStoreOperatingRecord>>>
    diagnostics: CateringStoreOperatingDiagnosticsEntry[]
    lastChangedAt?: number
}
