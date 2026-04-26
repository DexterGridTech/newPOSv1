import type {CateringProductTopic} from '../types'

export const cateringProductTopics = {
    productCategory: 'catering.product-category.profile',
    product: 'catering.product.profile',
    productInheritance: 'catering.product-inheritance.profile',
    brandMenu: 'catering.brand-menu.profile',
    menuCatalog: 'menu.catalog',
    priceRule: 'catering.price-rule.profile',
    bundlePriceRule: 'catering.bundle-price-rule.profile',
    channelProductMapping: 'catering.channel-product-mapping.profile',
} as const satisfies Record<string, CateringProductTopic>

export const cateringProductTopicList = Object.values(cateringProductTopics)
export const cateringProductTopicSet = new Set<string>(cateringProductTopicList)

export const isCateringProductTopic = (topic: string): topic is CateringProductTopic =>
    cateringProductTopicSet.has(topic)
