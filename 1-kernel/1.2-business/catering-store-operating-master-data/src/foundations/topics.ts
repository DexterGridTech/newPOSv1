import type {CateringStoreOperatingTopic} from '../types'

export const cateringStoreOperatingTopics = {
    menuAvailability: 'menu.availability',
    availabilityRule: 'catering.availability-rule.profile',
    saleableStock: 'catering.saleable-stock.profile',
    stockReservation: 'catering.stock-reservation.active',
} as const satisfies Record<string, CateringStoreOperatingTopic>

export const cateringStoreOperatingTopicList = Object.values(cateringStoreOperatingTopics)
export const cateringStoreOperatingTopicSet = new Set<string>(cateringStoreOperatingTopicList)

export const isCateringStoreOperatingTopic = (topic: string): topic is CateringStoreOperatingTopic =>
    cateringStoreOperatingTopicSet.has(topic)
