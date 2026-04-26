import {createSelector} from '@reduxjs/toolkit'
import type {RootState} from '@next/kernel-base-state-runtime'
import {selectTcpBindingSnapshot} from '@next/kernel-base-tcp-control-runtime-v2'
import {CATERING_PRODUCT_MASTER_DATA_STATE_KEY} from '../features/slices/masterData'
import {cateringProductTopics} from '../foundations/topics'
import type {
    CateringBrandMenuProfile,
    CateringProductCategoryProfile,
    CateringPriceRuleProfile,
    CateringProductMasterDataState,
    CateringProductProfile,
    ChannelProductMappingProfile,
    EffectiveMenuView,
    ProductInheritanceProfile,
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

const selectProductCategoryProfiles = createTopicValuesSelector<CateringProductCategoryProfile>('productCategory')
const selectCateringProductProfiles = createTopicValuesSelector<CateringProductProfile>('product')
const selectProductInheritanceProfiles = createTopicValuesSelector<ProductInheritanceProfile>('productInheritance')
const selectBrandMenuProfiles = createTopicValuesSelector<CateringBrandMenuProfile>('brandMenu')
const selectMenuCatalogProfiles = createTopicValuesSelector<TerminalMenuCatalog>('menuCatalog')
const selectPriceRuleProfiles = createTopicValuesSelector<CateringPriceRuleProfile>('priceRule')
const selectChannelProductMappingProfiles = createTopicValuesSelector<ChannelProductMappingProfile>('channelProductMapping')

export const selectCateringProductDiagnostics: (state: RootState) => CateringProductMasterDataState['diagnostics'] = createSelector(
    [selectCateringProductMasterDataState],
    masterData => masterData?.diagnostics ?? [],
)

export const selectCateringProductSummary: (state: RootState) => {
    products: number
    productCategories: number
    productInheritances: number
    brandMenus: number
    menuCatalogs: number
    priceRules: number
    channelMappings: number
    diagnostics: number
    lastChangedAt?: number
} = createSelector(
    [selectCateringProductMasterDataState],
    masterData => ({
        productCategories: Object.keys(masterData?.byTopic[cateringProductTopics.productCategory] ?? {}).length,
        products: Object.keys(masterData?.byTopic[cateringProductTopics.product] ?? {}).length,
        productInheritances: Object.keys(masterData?.byTopic[cateringProductTopics.productInheritance] ?? {}).length,
        brandMenus: Object.keys(masterData?.byTopic[cateringProductTopics.brandMenu] ?? {}).length,
        menuCatalogs: Object.keys(masterData?.byTopic[cateringProductTopics.menuCatalog] ?? {}).length,
        priceRules: Object.keys(masterData?.byTopic[cateringProductTopics.priceRule] ?? {}).length,
        channelMappings: Object.keys(masterData?.byTopic[cateringProductTopics.channelProductMapping] ?? {}).length,
        diagnostics: masterData?.diagnostics.length ?? 0,
        lastChangedAt: masterData?.lastChangedAt,
    }),
)

export const selectAllProductCategories: (state: RootState) => CateringProductCategoryProfile[] = createSelector(
    [selectProductCategoryProfiles],
    categories => categories,
)

export const selectAllCateringProducts: (state: RootState) => CateringProductProfile[] = createSelector(
    [selectCateringProductProfiles],
    products => products,
)

export const selectAllProductInheritances: (state: RootState) => ProductInheritanceProfile[] = createSelector(
    [selectProductInheritanceProfiles],
    inheritances => inheritances,
)

export const selectAllChannelProductMappings: (state: RootState) => ChannelProductMappingProfile[] = createSelector(
    [selectChannelProductMappingProfiles],
    mappings => mappings,
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
                                imageUrl: product?.image_url,
                                categoryId: product?.category_id,
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
        categoryId?: string
        type?: string
        ownershipScope?: string
        modifierGroupCount: number
        productionStepCount: number
        productionCategoryCount: number
        menuUsageCount: number
    }>
} = createSelector(
    [selectCurrentStoreEffectiveMenu, selectAllCateringProducts, selectAllMenuCatalogs, selectAllBrandMenus],
    (menu, products, menuCatalogs, brandMenus) => ({
        menu,
        productCards: products.map(product => ({
            productId: product.product_id,
            title: product.product_name ?? product.product_id,
            price: product.base_price,
            categoryId: product.category_id,
            type: product.product_type,
            ownershipScope: product.ownership_scope,
            modifierGroupCount: product.modifier_groups?.length ?? 0,
            productionStepCount: product.production_steps?.length ?? 0,
            productionCategoryCount: Array.isArray(product.production_profile?.category_codes)
                ? product.production_profile.category_codes.length
                : 0,
            menuUsageCount: [...menuCatalogs, ...brandMenus].filter(candidate =>
                (candidate.sections ?? []).some(section => {
                    const products = Array.isArray(section.products) ? section.products : []
                    return products.some((entry: Record<string, unknown>) => String(entry.product_id ?? '') === product.product_id)
                }),
            ).length,
        })),
    }),
)
