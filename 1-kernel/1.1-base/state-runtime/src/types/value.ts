import type {TimestampMs} from '@impos2/kernel-base-contracts'

export interface ValueWithUpdatedAt<TValue> {
    value: TValue
    updatedAt: TimestampMs
}
