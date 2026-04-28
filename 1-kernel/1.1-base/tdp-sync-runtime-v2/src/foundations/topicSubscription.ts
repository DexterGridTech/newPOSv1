import type {
    KernelRuntimeModuleDescriptorV2,
    TdpTopicInterestDeclarationV1,
} from '@next/kernel-base-runtime-shell-v2'

export const TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1 = 'tdp.topic-subscription.v1'
export const TDP_SUBSCRIPTION_HASH_CAPABILITY_V1 = 'tdp.subscription-hash.v1'
export const TDP_SNAPSHOT_CHUNK_CAPABILITY_V1 = 'tdp.snapshot-chunk.v1'

export interface ResolvedTdpSubscriptionV1 {
    version: 1
    mode: 'explicit'
    topics: readonly string[]
    hash: string
    requiredTopics: readonly string[]
    sources: readonly {
        moduleName: string
        topicKey: string
        category: 'projection' | 'command' | 'system'
        required: boolean
    }[]
}

const TOPIC_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/

export const validateTdpTopicKey = (topicKey: string): boolean =>
    topicKey.length <= 128 && TOPIC_KEY_PATTERN.test(topicKey) && !topicKey.includes('*')

const normalizeInterest = (
    interest: TdpTopicInterestDeclarationV1,
): Required<Pick<TdpTopicInterestDeclarationV1, 'topicKey'>> & {
    category: 'projection' | 'command' | 'system'
    required: boolean
} => {
    const topicKey = interest.topicKey.trim()
    if (!validateTdpTopicKey(topicKey)) {
        throw new Error(`Invalid TDP topic key: ${interest.topicKey}`)
    }
    return {
        topicKey,
        category: interest.category ?? 'projection',
        required: interest.required === true,
    }
}

const fnv1a64 = (input: string): string => {
    let hash = 0xcbf29ce484222325n
    const prime = 0x100000001b3n
    for (let index = 0; index < input.length; index += 1) {
        hash ^= BigInt(input.charCodeAt(index))
        hash = BigInt.asUintN(64, hash * prime)
    }
    return hash.toString(16).padStart(16, '0')
}

export const computeTdpSubscriptionHash = (
    topics: readonly {topicKey: string}[],
): string => {
    const normalized = topics
        .map(topic => topic.topicKey.trim())
        .sort()
        .join('|')
    return `fnv1a64:${fnv1a64(`tdp-subscription-v1|${normalized}`)}`
}

export const resolveTdpSubscriptionFromDescriptors = (
    descriptors: readonly KernelRuntimeModuleDescriptorV2[],
): ResolvedTdpSubscriptionV1 => {
    const byTopic = new Map<string, {
        topicKey: string
        category: 'projection' | 'command' | 'system'
        required: boolean
        moduleNames: string[]
    }>()

    descriptors.forEach(descriptor => {
        descriptor.tdpTopicInterests.forEach(rawInterest => {
            const interest = normalizeInterest(rawInterest)
            const current = byTopic.get(interest.topicKey)
            if (!current) {
                byTopic.set(interest.topicKey, {
                    ...interest,
                    moduleNames: [descriptor.moduleName],
                })
                return
            }
            current.required = current.required || interest.required
            if (current.category !== 'system' && interest.category === 'system') {
                current.category = 'system'
            } else if (current.category === 'projection' && interest.category === 'command') {
                current.category = 'command'
            }
            current.moduleNames.push(descriptor.moduleName)
        })
    })

    const normalizedTopics = [...byTopic.values()]
        .sort((left, right) => left.topicKey.localeCompare(right.topicKey))

    return {
        version: 1,
        mode: 'explicit',
        topics: normalizedTopics.map(topic => topic.topicKey),
        requiredTopics: normalizedTopics
            .filter(topic => topic.required)
            .map(topic => topic.topicKey),
        hash: computeTdpSubscriptionHash(normalizedTopics),
        sources: normalizedTopics.flatMap(topic =>
            topic.moduleNames.map(moduleName => ({
                moduleName,
                topicKey: topic.topicKey,
                category: topic.category,
                required: topic.required,
            })),
        ),
    }
}
