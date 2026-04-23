import type {TimestampMs} from '../types/ids'

export const nowTimestampMs = (): TimestampMs => Date.now()

export const formatTimestampMs = (timestamp: TimestampMs): string => {
    const value = new Date(timestamp)
    const pad2 = (input: number) => String(input).padStart(2, '0')
    const pad3 = (input: number) => String(input).padStart(3, '0')

    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())} ${pad3(value.getMilliseconds())}`
}
