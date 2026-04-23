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

const activeTopicValues = <TData extends Record<string, unknown>>(
    state: RootState,
    topic: keyof typeof cateringProductTopics,
) => Object.values(selectCateringProductMasterDataState(state)?.byTopic[cateringProductTopics[topic]] ?? {})
    .filter(record => !record.tombstone)
    .map(record => record.data as TData)

export const selectCateringProductDiagnostics = (state: RootState) =>
    selectCateringProductMasterDataState(state)?.diagnostics ?? []

export const selectCateringProductSummary = (state: RootState) => {
    const masterData = selectCateringProductMasterDataState(state)
    return {
        products: Object.keys(masterData?.byTopic[cateringProductTopics.product] ?? {}).length,
        brandMenus: Object.keys(masterData?.byTopic[cateringProductTopics.brandMenu] ?? {}).length,
        menuCatalogs: Object.keys(masterData?.byTopic[cateringProductTopics.menuCatalog] ?? {}).length,
        diagnostics: masterData?.diagnostics.length ?? 0,
        lastChangedAt: masterData?.lastChangedAt,
    }
}

export const selectAllCateringProducts = (state: RootState): CateringProductProfile[] =>
    activeTopicValues<CateringProductProfile>(state, 'product')

export const selectAllBrandMenus = (state: RootState): CateringBrandMenuProfile[] =>
    activeTopicValues<CateringBrandMenuProfile>(state, 'brandMenu')

export const selectAllMenuCatalogs = (state: RootState): TerminalMenuCatalog[] =>
    activeTopicValues<TerminalMenuCatalog>(state, 'menuCatalog')

export const selectCurrentStoreEffectiveMenu = (state: RootState): EffectiveMenuView | undefined => {
    const binding = selectTcpBindingSnapshot(state)
    const products = selectAllCateringProducts(state)
    const menu = selectAllMenuCatalogs(state).find(candidate => candidate.store_id === binding.storeId)
        ?? selectAllMenuCatalogs(state)[0]
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
}

export const selectProductsByMenuSection = (state: RootState) =>
    selectCurrentStoreEffectiveMenu(state)?.sections ?? []

export const selectPriceRulesByProductId = (state: RootState, productId: string): CateringPriceRuleProfile[] =>
    activeTopicValues<CateringPriceRuleProfile>(state, 'priceRule')
        .filter(rule => rule.product_id === productId)

export const selectCateringProductDisplayModel = (state: RootState) => {
    const menu = selectCurrentStoreEffectiveMenu(state)
    const products = selectAllCateringProducts(state)
    return {
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
    }
}
