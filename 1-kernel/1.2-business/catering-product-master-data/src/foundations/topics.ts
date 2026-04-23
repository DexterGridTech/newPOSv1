import type {CateringProductTopic} from '../types'

export const cateringProductTopics = {
    product: 'catering.product.profile',
    brandMenu: 'catering.brand-menu.profile',
    menuCatalog: 'menu.catalog',
    priceRule: 'catering.price-rule.profile',
    bundlePriceRule: 'catering.bundle-price-rule.profile',
} as const satisfies Record<string, CateringProductTopic>

export const cateringProductTopicList = Object.values(cateringProductTopics)
export const cateringProductTopicSet = new Set<string>(cateringProductTopicList)

export const isCateringProductTopic = (topic: string): topic is CateringProductTopic =>
    cateringProductTopicSet.has(topic)
