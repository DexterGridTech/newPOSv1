import {createSelector} from '@reduxjs/toolkit'
import type {RootState} from '@next/kernel-base-state-runtime'
import {selectTcpBindingSnapshot} from '@next/kernel-base-tcp-control-runtime-v2'
import {CATERING_STORE_OPERATING_MASTER_DATA_STATE_KEY} from '../features/slices/masterData'
import {cateringStoreOperatingTopics} from '../foundations/topics'
import type {
    CateringStoreOperatingMasterDataState,
    StoreConfigProfile,
    MenuAvailabilityProfile,
    SaleableStockProfile,
    StockReservationProfile,
} from '../types'

export const selectCateringStoreOperatingMasterDataState = (
    state: RootState,
) => state[CATERING_STORE_OPERATING_MASTER_DATA_STATE_KEY as keyof RootState] as CateringStoreOperatingMasterDataState | undefined

const activeTopicValuesFromMasterData = <TData extends Record<string, unknown>>(
    masterData: CateringStoreOperatingMasterDataState | undefined,
    topic: keyof typeof cateringStoreOperatingTopics,
) => Object.values(masterData?.byTopic[cateringStoreOperatingTopics[topic]] ?? {})
    .filter(record => !record.tombstone)
    .map(record => record.data as TData)

const createTopicValuesSelector = <TData extends Record<string, unknown>>(
    topic: keyof typeof cateringStoreOperatingTopics,
) => createSelector(
    [selectCateringStoreOperatingMasterDataState],
    masterData => activeTopicValuesFromMasterData<TData>(masterData, topic),
)

const selectMenuAvailabilityProfiles = createTopicValuesSelector<MenuAvailabilityProfile>('menuAvailability')
const selectStoreConfigProfiles = createTopicValuesSelector<StoreConfigProfile>('storeConfig')
const selectSaleableStockProfiles = createTopicValuesSelector<SaleableStockProfile>('saleableStock')
const selectStockReservationProfiles = createTopicValuesSelector<StockReservationProfile>('stockReservation')

export const selectCateringStoreOperatingDiagnostics: (
    state: RootState,
) => CateringStoreOperatingMasterDataState['diagnostics'] = createSelector(
    [selectCateringStoreOperatingMasterDataState],
    masterData => masterData?.diagnostics ?? [],
)

export const selectCateringStoreOperatingSummary: (state: RootState) => {
    availability: number
    stocks: number
    reservations: number
    diagnostics: number
    lastChangedAt?: number
} = createSelector(
    [selectCateringStoreOperatingMasterDataState],
    masterData => ({
        availability: Object.keys(masterData?.byTopic[cateringStoreOperatingTopics.menuAvailability] ?? {}).length,
        configs: Object.keys(masterData?.byTopic[cateringStoreOperatingTopics.storeConfig] ?? {}).length,
        stocks: Object.keys(masterData?.byTopic[cateringStoreOperatingTopics.saleableStock] ?? {}).length,
        reservations: Object.keys(masterData?.byTopic[cateringStoreOperatingTopics.stockReservation] ?? {}).length,
        diagnostics: masterData?.diagnostics.length ?? 0,
        lastChangedAt: masterData?.lastChangedAt,
    }),
)

export const selectMenuAvailabilityByProductId: (state: RootState) => MenuAvailabilityProfile[] = createSelector(
    [selectMenuAvailabilityProfiles, selectTcpBindingSnapshot],
    (availability, binding): MenuAvailabilityProfile[] => availability
        .filter(item => !binding.storeId || item.store_id === binding.storeId)
)

export const selectCurrentStoreConfig: (state: RootState) => StoreConfigProfile | undefined = createSelector(
    [selectStoreConfigProfiles, selectTcpBindingSnapshot],
    (configs, binding): StoreConfigProfile | undefined => configs.find(item => !binding.storeId || item.store_id === binding.storeId)
        ?? configs[0],
)

export const selectSaleableStockByProductId: (state: RootState) => SaleableStockProfile[] = createSelector(
    [selectSaleableStockProfiles, selectTcpBindingSnapshot],
    (stocks, binding): SaleableStockProfile[] => stocks
        .filter(item => !binding.storeId || item.store_id === binding.storeId)
)

export const selectActiveStockReservations: (state: RootState) => StockReservationProfile[] = createSelector(
    [selectStockReservationProfiles, selectTcpBindingSnapshot],
    (reservations, binding): StockReservationProfile[] => reservations
        .filter(item => !binding.storeId || item.store_id === binding.storeId)
)

export const selectStoreOperatingStatus: (state: RootState) => {
    totalAvailabilityItems: number
    availableItems: number
    soldOutItems: number
    lowStockItems: number
    activeReservations: number
} = createSelector(
    [
        selectMenuAvailabilityByProductId,
        selectSaleableStockByProductId,
        selectActiveStockReservations,
    ],
    (availability, stocks, reservations) => {
        const soldOut = availability.filter(item => item.available === false)
        const lowStock = stocks.filter(item => (item.saleable_quantity ?? 0) <= (item.safety_stock ?? 0))
        return {
            totalAvailabilityItems: availability.length,
            availableItems: availability.filter(item => item.available !== false).length,
            soldOutItems: soldOut.length,
            lowStockItems: lowStock.length,
            activeReservations: reservations.filter(item => item.reservation_status === 'ACTIVE').length,
        }
    },
)

export const selectOperationDashboardModel: (state: RootState) => {
    storeConfig?: {
        businessStatus?: string
        acceptOrder?: boolean
        operatingHoursCount: number
        extraChargeRuleCount: number
    }
    availabilityRows: Array<{
        productId: string
        available: boolean
        soldOutReason: string | null
        effectiveFrom: string | undefined
    }>
    stockRows: Array<{
        stockId: string
        productId: string | undefined
        saleableQuantity: number
        safetyStock: number
        status: string | undefined
    }>
    reservationRows: Array<{
        reservationId: string
        productId: string | undefined
        reservedQuantity: number
        status: string | undefined
        expiresAt: string | undefined
    }>
} = createSelector(
    [
        selectCurrentStoreConfig,
        selectMenuAvailabilityByProductId,
        selectSaleableStockByProductId,
        selectActiveStockReservations,
    ],
    (storeConfig, availability, stocks, reservations) => ({
        storeConfig: storeConfig
            ? {
                businessStatus: storeConfig.business_status,
                acceptOrder: storeConfig.accept_order,
                operatingHoursCount: storeConfig.operating_hours?.length ?? 0,
                extraChargeRuleCount: storeConfig.extra_charge_rules?.length ?? 0,
            }
            : undefined,
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
    }),
)
