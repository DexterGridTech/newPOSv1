export const benefitSessionTopics = {
    templateProfile: 'commercial.benefit-template.profile',
    activityProfile: 'commercial.benefit-activity.profile',
} as const

export type BenefitSessionTopic = typeof benefitSessionTopics[keyof typeof benefitSessionTopics]

export const benefitSessionTopicList: BenefitSessionTopic[] = [
    benefitSessionTopics.templateProfile,
    benefitSessionTopics.activityProfile,
]

export const isBenefitSessionTopic = (topic: string): topic is BenefitSessionTopic =>
    benefitSessionTopicList.includes(topic as BenefitSessionTopic)
