import React from 'react'
import {Text, TouchableOpacity, View} from 'react-native'
import type {UiAlertInfo} from '@next/kernel-base-ui-runtime-v2'
import {useUiRuntime} from '../../contexts'

export const DefaultAlert: React.FC<UiAlertInfo> = ({
    title = '提示',
    message = '',
    autoConfirmAfterMs,
    confirmText,
    cancelText,
    confirmAction,
    cancelAction,
    }) => (
    <AlertLayout
        title={title}
        message={message}
        autoConfirmAfterMs={autoConfirmAfterMs}
        confirmText={confirmText}
        cancelText={cancelText}
        confirmAction={confirmAction}
        cancelAction={cancelAction}
    />
)

const AlertLayout: React.FC<UiAlertInfo> = ({
    title = '提示',
    message = '',
    autoConfirmAfterMs,
    confirmText,
    cancelText,
    confirmAction,
    cancelAction,
}) => {
    const runtime = useUiRuntime()
    const [remainingMs, setRemainingMs] = React.useState<number | null>(
        typeof autoConfirmAfterMs === 'number' && autoConfirmAfterMs > 0
            ? autoConfirmAfterMs
            : null,
    )
    const runAction = React.useCallback(async (commands?: readonly unknown[]) => {
        for (const command of commands ?? []) {
            await runtime.dispatchCommand(command as Parameters<typeof runtime.dispatchCommand>[0])
        }
    }, [runtime])
    const confirmTriggeredRef = React.useRef(false)

    React.useEffect(() => {
        confirmTriggeredRef.current = false
        setRemainingMs(
            typeof autoConfirmAfterMs === 'number' && autoConfirmAfterMs > 0
                ? autoConfirmAfterMs
                : null,
        )
    }, [autoConfirmAfterMs, title, message])

    React.useEffect(() => {
        if (remainingMs == null || remainingMs <= 0) {
            if (remainingMs === 0 && !confirmTriggeredRef.current) {
                confirmTriggeredRef.current = true
                void runAction(confirmAction?.commands)
            }
            return
        }
        const timer = setTimeout(() => {
            setRemainingMs(current => {
                if (current == null) {
                    return current
                }
                return Math.max(0, current - 1000)
            })
        }, 1000)
        return () => clearTimeout(timer)
    }, [remainingMs, confirmAction?.commands, runAction])

    const remainingSeconds = remainingMs == null ? null : Math.ceil(remainingMs / 1000)

    return (
        <View
            testID="ui-base-default-alert"
            style={{
                margin: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#d1d5db',
                backgroundColor: '#ffffff',
                padding: 16,
                gap: 12,
            }}
        >
            <Text
                testID="ui-base-default-alert:title"
                style={{fontSize: 18, fontWeight: '700', color: '#111827'}}
            >
                {title}
            </Text>
            <Text
                testID="ui-base-default-alert:message"
                style={{fontSize: 14, lineHeight: 20, color: '#374151'}}
            >
                {message}
            </Text>
            {remainingSeconds != null ? (
                <Text
                    testID="ui-base-default-alert:countdown"
                    style={{fontSize: 12, fontWeight: '600', color: '#2563eb'}}
                >
                    {`${remainingSeconds} 秒后自动确认`}
                </Text>
            ) : null}
            {(cancelText || confirmText) ? (
                <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 12}}>
                    {cancelText ? (
                        <TouchableOpacity
                            testID="ui-base-default-alert:cancel"
                            accessibilityRole="button"
                            onPress={() => {
                                void runAction(cancelAction?.commands)
                            }}
                            style={{
                                minWidth: 96,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: '#d1d5db',
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                            }}
                        >
                            <Text style={{textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#374151'}}>
                                {cancelText}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    {confirmText ? (
                        <TouchableOpacity
                            testID="ui-base-default-alert:confirm"
                            accessibilityRole="button"
                            onPress={() => {
                                void runAction(confirmAction?.commands)
                            }}
                            style={{
                                minWidth: 96,
                                borderRadius: 10,
                                backgroundColor: '#2563eb',
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                            }}
                        >
                            <Text style={{textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#ffffff'}}>
                                {confirmText}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}
        </View>
    )
}
