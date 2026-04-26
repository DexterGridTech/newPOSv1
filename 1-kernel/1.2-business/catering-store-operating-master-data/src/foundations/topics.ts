import type {CateringStoreOperatingTopic} from '../types'

export const cateringStoreOperatingTopics = {
    storeConfig: 'store.config',
    menuAvailability: 'menu.availability',
    availabilityRule: 'catering.availability-rule.profile',
    saleableStock: 'catering.saleable-stock.profile',
} as const satisfies Record<string, CateringStoreOperatingTopic>

export const cateringStoreOperatingTopicList = Object.values(cateringStoreOperatingTopics)
export const cateringStoreOperatingTopicSet = new Set<string>(cateringStoreOperatingTopicList)

export const isCateringStoreOperatingTopic = (topic: string): topic is CateringStoreOperatingTopic =>
    cateringStoreOperatingTopicSet.has(topic)
