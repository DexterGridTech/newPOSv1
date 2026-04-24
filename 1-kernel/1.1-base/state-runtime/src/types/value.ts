import type {TimestampMs} from '@next/kernel-base-contracts'

export interface ValueWithUpdatedAt<TValue> {
    value: TValue
    updatedAt: TimestampMs
}
