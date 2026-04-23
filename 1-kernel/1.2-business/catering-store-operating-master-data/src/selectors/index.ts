import type {RootState} from '@impos2/kernel-base-state-runtime'
import {selectTcpBindingSnapshot} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {CATERING_STORE_OPERATING_MASTER_DATA_STATE_KEY} from '../features/slices/masterData'
import {cateringStoreOperatingTopics} from '../foundations/topics'
import type {
    CateringStoreOperatingMasterDataState,
    MenuAvailabilityProfile,
    SaleableStockProfile,
    StockReservationProfile,
} from '../types'

export const selectCateringStoreOperatingMasterDataState = (
    state: RootState,
) => state[CATERING_STORE_OPERATING_MASTER_DATA_STATE_KEY as keyof RootState] as CateringStoreOperatingMasterDataState | undefined

const activeTopicValues = <TData extends Record<string, unknown>>(
    state: RootState,
    topic: keyof typeof cateringStoreOperatingTopics,
) => Object.values(selectCateringStoreOperatingMasterDataState(state)?.byTopic[cateringStoreOperatingTopics[topic]] ?? {})
    .filter(record => !record.tombstone)
    .map(record => record.data as TData)

export const selectCateringStoreOperatingDiagnostics = (state: RootState) =>
    selectCateringStoreOperatingMasterDataState(state)?.diagnostics ?? []

export const selectCateringStoreOperatingSummary = (state: RootState) => {
    const masterData = selectCateringStoreOperatingMasterDataState(state)
    return {
        availability: Object.keys(masterData?.byTopic[cateringStoreOperatingTopics.menuAvailability] ?? {}).length,
        stocks: Object.keys(masterData?.byTopic[cateringStoreOperatingTopics.saleableStock] ?? {}).length,
        reservations: Object.keys(masterData?.byTopic[cateringStoreOperatingTopics.stockReservation] ?? {}).length,
        diagnostics: masterData?.diagnostics.length ?? 0,
        lastChangedAt: masterData?.lastChangedAt,
    }
}

export const selectMenuAvailabilityByProductId = (state: RootState): MenuAvailabilityProfile[] => {
    const binding = selectTcpBindingSnapshot(state)
    return activeTopicValues<MenuAvailabilityProfile>(state, 'menuAvailability')
        .filter(item => !binding.storeId || item.store_id === binding.storeId)
}

export const selectSaleableStockByProductId = (state: RootState): SaleableStockProfile[] => {
    const binding = selectTcpBindingSnapshot(state)
    return activeTopicValues<SaleableStockProfile>(state, 'saleableStock')
        .filter(item => !binding.storeId || item.store_id === binding.storeId)
}

export const selectActiveStockReservations = (state: RootState): StockReservationProfile[] => {
    const binding = selectTcpBindingSnapshot(state)
    return activeTopicValues<StockReservationProfile>(state, 'stockReservation')
        .filter(item => !binding.storeId || item.store_id === binding.storeId)
}

export const selectStoreOperatingStatus = (state: RootState) => {
    const availability = selectMenuAvailabilityByProductId(state)
    const stocks = selectSaleableStockByProductId(state)
    const reservations = selectActiveStockReservations(state)
    const soldOut = availability.filter(item => item.available === false)
    const lowStock = stocks.filter(item => (item.saleable_quantity ?? 0) <= (item.safety_stock ?? 0))
    return {
        totalAvailabilityItems: availability.length,
        availableItems: availability.filter(item => item.available !== false).length,
        soldOutItems: soldOut.length,
        lowStockItems: lowStock.length,
        activeReservations: reservations.filter(item => item.reservation_status === 'ACTIVE').length,
    }
}

export const selectOperationDashboardModel = (state: RootState) => {
    const availability = selectMenuAvailabilityByProductId(state)
    const stocks = selectSaleableStockByProductId(state)
    const reservations = selectActiveStockReservations(state)
    return {
        availabilityRows: availability.map(item => ({
            productId: item.product_id,
            available: item.available !== false,
            soldOutReason: item.sold_out_reason ?? null,
            effectiveFrom: item.effective_from,
        })),
        stockRows: stocks.map(item => ({
            stockId: item.stock_id,
            productId: item.product_id,
            saleableQuantity: item.saleable_quantity ?? 0,
            safetyStock: item.safety_stock ?? 0,
            status: item.status,
        })),
        reservationRows: reservations.map(item => ({
            reservationId: item.reservation_id,
            productId: item.product_id,
            reservedQuantity: item.reserved_quantity ?? 0,
            status: item.reservation_status,
            expiresAt: item.expires_at,
        })),
    }
}
