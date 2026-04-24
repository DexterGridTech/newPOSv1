import {createSelector} from '@reduxjs/toolkit'
import type {RootState} from '@impos2/kernel-base-state-runtime'
import {selectTcpBindingSnapshot} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {CATERING_PRODUCT_MASTER_DATA_STATE_KEY} from '../features/slices/masterData'
import {cateringProductTopics} from '../foundations/topics'
import type {
    CateringBrandMenuProfile,
    CateringPriceRuleProfile,
    CateringProductMasterDataState,
    CateringProductProfile,
    EffectiveMenuView,
    TerminalMenuCatalog,
} from '../types'

export const selectCateringProductMasterDataState = (
    state: RootState,
) => state[CATERING_PRODUCT_MASTER_DATA_STATE_KEY as keyof RootState] as CateringProductMasterDataState | undefined

const activeTopicValuesFromMasterData = <TData extends Record<string, unknown>>(
    masterData: CateringProductMasterDataState | undefined,
    topic: keyof typeof cateringProductTopics,
) => Object.values(masterData?.byTopic[cateringProductTopics[topic]] ?? {})
    .filter(record => !record.tombstone)
    .map(record => record.data as TData)

const createTopicValuesSelector = <TData extends Record<string, unknown>>(
    topic: keyof typeof cateringProductTopics,
) => createSelector(
    [selectCateringProductMasterDataState],
    masterData => activeTopicValuesFromMasterData<TData>(masterData, topic),
)

const selectCateringProductProfiles = createTopicValuesSelector<CateringProductProfile>('product')
const selectBrandMenuProfiles = createTopicValuesSelector<CateringBrandMenuProfile>('brandMenu')
const selectMenuCatalogProfiles = createTopicValuesSelector<TerminalMenuCatalog>('menuCatalog')
const selectPriceRuleProfiles = createTopicValuesSelector<CateringPriceRuleProfile>('priceRule')

export const selectCateringProductDiagnostics: (state: RootState) => CateringProductMasterDataState['diagnostics'] = createSelector(
    [selectCateringProductMasterDataState],
    masterData => masterData?.diagnostics ?? [],
)

export const selectCateringProductSummary: (state: RootState) => {
    products: number
    brandMenus: number
    menuCatalogs: number
    diagnostics: number
    lastChangedAt?: number
} = createSelector(
    [selectCateringProductMasterDataState],
    masterData => ({
        products: Object.keys(masterData?.byTopic[cateringProductTopics.product] ?? {}).length,
        brandMenus: Object.keys(masterData?.byTopic[cateringProductTopics.brandMenu] ?? {}).length,
        menuCatalogs: Object.keys(masterData?.byTopic[cateringProductTopics.menuCatalog] ?? {}).length,
        diagnostics: masterData?.diagnostics.length ?? 0,
        lastChangedAt: masterData?.lastChangedAt,
    }),
)

export const selectAllCateringProducts: (state: RootState) => CateringProductProfile[] = createSelector(
    [selectCateringProductProfiles],
    products => products,
)

export const selectLatestCateringProduct: (state: RootState) => CateringProductProfile | undefined = createSelector(
    [selectCateringProductMasterDataState],
    masterData => Object.values(masterData?.byTopic[cateringProductTopics.product] ?? {})
        .filter(record => !record.tombstone)
        .slice()
        .sort((left, right) => {
            const changedAt = (right.updatedAt ?? 0) - (left.updatedAt ?? 0)
            if (changedAt !== 0) {
                return changedAt
            }
            return (right.sourceRevision ?? right.revision ?? 0) - (left.sourceRevision ?? left.revision ?? 0)
        })[0]?.data as CateringProductProfile | undefined,
)

export const selectAllBrandMenus: (state: RootState) => CateringBrandMenuProfile[] = createSelector(
    [selectBrandMenuProfiles],
    brandMenus => brandMenus,
)

export const selectAllMenuCatalogs: (state: RootState) => TerminalMenuCatalog[] = createSelector(
    [selectMenuCatalogProfiles],
    menuCatalogs => menuCatalogs,
)

export const selectCurrentStoreEffectiveMenu: (state: RootState) => EffectiveMenuView | undefined = createSelector(
    [selectTcpBindingSnapshot, selectAllCateringProducts, selectAllMenuCatalogs],
    (binding, products, menus): EffectiveMenuView | undefined => {
        const menu = menus.find(candidate => candidate.store_id === binding.storeId)
            ?? menus[0]
        if (!menu) {
            return undefined
        }
        return {
            menuId: menu.menu_id,
            menuName: menu.menu_name ?? menu.menu_id,
            storeId: menu.store_id,
            versionHash: menu.version_hash,
            sections: (menu.sections ?? [])
                .slice()
                .sort((left, right) => (left.display_order ?? 0) - (right.display_order ?? 0))
                .map(section => ({
                    sectionId: section.section_id,
                    sectionName: section.section_name ?? section.section_id,
                    displayOrder: section.display_order ?? 0,
                    products: (section.products ?? [])
                        .slice()
                        .sort((left, right) => Number(left.display_order ?? 0) - Number(right.display_order ?? 0))
                        .map(entry => {
                            const productId = String(entry.product_id ?? '')
                            const product = products.find(candidate => candidate.product_id === productId)
                            return {
                                productId,
                                displayOrder: Number(entry.display_order ?? 0),
                                title: product?.product_name ?? productId,
                                price: product?.base_price,
                                productType: product?.product_type,
                            }
                        }),
                })),
        }
    },
)

export const selectProductsByMenuSection: (state: RootState) => EffectiveMenuView['sections'] = createSelector(
    [selectCurrentStoreEffectiveMenu],
    menu => menu?.sections ?? [],
)

export const selectPriceRulesByProductId: (state: RootState, productId: string) => CateringPriceRuleProfile[] = createSelector(
    [
        selectPriceRuleProfiles,
        (_state: RootState, productId: string) => productId,
    ],
    (rules, productId): CateringPriceRuleProfile[] => rules
        .filter(rule => rule.product_id === productId),
)

export const selectCateringProductDisplayModel: (state: RootState) => {
    menu: EffectiveMenuView | undefined
    productCards: Array<{
        productId: string
        title: string
        price?: number
        type?: string
        ownershipScope?: string
        modifierGroupCount: number
        productionStepCount: number
    }>
} = createSelector(
    [selectCurrentStoreEffectiveMenu, selectAllCateringProducts],
    (menu, products) => ({
        menu,
        productCards: products.map(product => ({
            productId: product.product_id,
            title: product.product_name ?? product.product_id,
            price: product.base_price,
            type: product.product_type,
            ownershipScope: product.ownership_scope,
            modifierGroupCount: product.modifier_groups?.length ?? 0,
            productionStepCount: product.production_steps?.length ?? 0,
        })),
    }),
)
