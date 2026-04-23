import React, {useEffect, useState} from 'react'
import {Text, View} from 'react-native'

export interface HotUpdateProgressModalProps {
    title?: string
    countdownSeconds?: number
}

export const HotUpdateProgressModal: React.FC<HotUpdateProgressModalProps> = ({
    title = '程序更新中',
    countdownSeconds = 3,
}) => {
    const [remaining, setRemaining] = useState(Math.max(0, Math.ceil(countdownSeconds)))

    useEffect(() => {
        setRemaining(Math.max(0, Math.ceil(countdownSeconds)))
        const startedAt = Date.now()
        const durationMs = Math.max(0, countdownSeconds) * 1000
        const timer = setInterval(() => {
            const elapsed = Date.now() - startedAt
            const next = Math.max(0, Math.ceil((durationMs - elapsed) / 1000))
            setRemaining(next)
            if (elapsed >= durationMs) {
                clearInterval(timer)
            }
        }, 100)
        return () => clearInterval(timer)
    }, [countdownSeconds])

    return (
        <View
            testID="ui-base-hot-update-progress-modal"
            style={{
                minHeight: 220,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 32,
                paddingVertical: 24,
                backgroundColor: 'rgba(0, 0, 0, 0.82)',
            }}
        >
            <Text
                testID="ui-base-hot-update-progress-modal:title"
                style={{
                    color: '#ffffff',
                    fontSize: 28,
                    fontWeight: '700',
                    marginBottom: 16,
                }}
            >
                {title}
            </Text>
            <Text
                testID="ui-base-hot-update-progress-modal:countdown"
                style={{
                    color: '#ffffff',
                    fontSize: 20,
                    fontWeight: '500',
                }}
            >
                {remaining}
            </Text>
        </View>
    )
}
