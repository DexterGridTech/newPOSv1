import React from 'react'
import {Text, TouchableOpacity, View} from 'react-native'
import type {UiAlertInfo} from '@impos2/kernel-base-ui-runtime-v2'
import {useUiRuntime} from '../../contexts'

export const DefaultAlert: React.FC<UiAlertInfo> = ({
    title = '提示',
    message = '',
    confirmText,
    cancelText,
    confirmAction,
    cancelAction,
    }) => (
    <AlertLayout
        title={title}
        message={message}
        confirmText={confirmText}
        cancelText={cancelText}
        confirmAction={confirmAction}
        cancelAction={cancelAction}
    />
)

const AlertLayout: React.FC<UiAlertInfo> = ({
    title = '提示',
    message = '',
    confirmText,
    cancelText,
    confirmAction,
    cancelAction,
}) => {
    const runtime = useUiRuntime()
    const runAction = React.useCallback(async (commands?: readonly unknown[]) => {
        for (const command of commands ?? []) {
            await runtime.dispatchCommand(command as Parameters<typeof runtime.dispatchCommand>[0])
        }
    }, [runtime])

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
