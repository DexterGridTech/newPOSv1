import React from 'react'
import {Pressable, Text, View, type StyleProp, type ViewStyle} from 'react-native'
import {
    useOptionalUiAutomationBridge,
    useOptionalUiAutomationRuntimeId,
    useOptionalUiAutomationTarget,
} from '@next/ui-base-runtime-react'
import {getVirtualKeyboardLayout} from '../../foundations'
import {useOptionalInputRuntime} from '../../contexts'
import type {VirtualKeyboardKey} from '../../types'

export interface VirtualKeyboardOverlayProps {
    visible?: boolean
    onKeyPress?: (key: VirtualKeyboardKey) => void
}

const overlayColors = {
    panel: '#0f172a',
    previewSurface: '#111f37',
    previewBorder: '#334155',
    previewValue: '#f8fafc',
    previewPlaceholder: '#94a3b8',
    title: '#cbd5e1',
    utilityKey: '#1e293b',
    utilityKeyPressed: '#334155',
    normalKey: '#f8fafc',
    normalKeyPressed: '#dbe4f0',
    normalKeyBorder: '#cbd5e1',
    primaryKey: '#0b5fff',
    primaryKeyPressed: '#0a4fe0',
} as const

const isUtilityKey = (key: VirtualKeyboardKey): boolean =>
    key === 'backspace' || key === 'clear'

const pressedScaleStyle = (
    pressed: boolean,
    scale: number,
): StyleProp<ViewStyle> => pressed
    ? {transform: [{scale}]}
    : null

const getKeyLabel = (key: VirtualKeyboardKey): string => {
    if (key === 'backspace') {
        return '退格'
    }
    if (key === 'clear') {
        return '清空'
    }
    return key
}

export const VirtualKeyboardOverlay: React.FC<VirtualKeyboardOverlayProps> = ({
    visible,
    onKeyPress,
}) => {
    const runtime = useOptionalInputRuntime()
    const automationBridge = useOptionalUiAutomationBridge()
    const automationRuntimeId = useOptionalUiAutomationRuntimeId() ?? 'runtime'
    const automationTarget = useOptionalUiAutomationTarget() ?? 'primary'
    const activeInput = runtime?.activeInput ?? null
    const actualVisible = visible ?? Boolean(activeInput)
    const layout = activeInput
        ? getVirtualKeyboardLayout(activeInput.mode)
        : null
    const previewValue = activeInput
        ? (
            activeInput.secureTextEntry
                ? '•'.repeat(activeInput.value.length)
                : (activeInput.value || activeInput.placeholder || '')
        )
        : ''

    React.useEffect(() => {
        if (!automationBridge || !actualVisible || !activeInput || !layout) {
            return undefined
        }
        const unregisterHost = automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'input',
            mountId: 'virtual-keyboard',
            nodeId: 'ui-base-virtual-keyboard',
            testID: 'ui-base-virtual-keyboard',
            semanticId: 'ui-base-virtual-keyboard',
            role: 'keyboard',
            text: previewValue,
            value: activeInput.value,
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: [],
        })
        const allKeys: VirtualKeyboardKey[] = ['close', ...layout.rows.flat(), 'enter']
        const unregisterKeys = allKeys.map(key => automationBridge.registerNode({
            target: automationTarget,
            runtimeId: automationRuntimeId,
            screenKey: 'input',
            mountId: `virtual-keyboard:key:${key}`,
            nodeId: `ui-base-virtual-keyboard:key:${key}`,
            testID: `ui-base-virtual-keyboard:key:${key}`,
            semanticId: `ui-base-virtual-keyboard:key:${key}`,
            role: 'button',
            text: key,
            visible: true,
            enabled: true,
            persistent: true,
            availableActions: ['press'],
            onAutomationAction: () => {
                onKeyPress?.(key)
                runtime?.applyVirtualKey(key)
                return {ok: true}
            },
        }))
        return () => {
            unregisterHost()
            unregisterKeys.forEach(unregister => unregister())
        }
    }, [activeInput, actualVisible, automationBridge, automationRuntimeId, automationTarget, layout, onKeyPress, previewValue, runtime])

    if (!actualVisible || !activeInput || !layout) {
        return null
    }

    return (
        <View
            testID="ui-base-virtual-keyboard"
            style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 16,
                width: '100%',
                maxWidth: layout.maxWidth,
                alignSelf: 'center',
                borderRadius: 20,
                backgroundColor: overlayColors.panel,
                padding: 16,
                gap: 12,
            }}
        >
            <View style={{position: 'relative', minHeight: 72, justifyContent: 'center'}}>
                <View
                    style={{
                        minHeight: 72,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: overlayColors.previewBorder,
                        backgroundColor: overlayColors.previewSurface,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text
                        testID="ui-base-virtual-keyboard:title"
                        style={{color: overlayColors.title, fontSize: 13, fontWeight: '600', textAlign: 'center'}}
                    >
                        {layout.title}
                    </Text>
                    <Text
                        testID="ui-base-virtual-keyboard:value"
                        style={{
                            color: activeInput.value.length > 0
                                ? overlayColors.previewValue
                                : overlayColors.previewPlaceholder,
                            marginTop: 6,
                            textAlign: 'center',
                            fontSize: 20,
                            fontWeight: '700',
                            letterSpacing: 0.4,
                        }}
                    >
                        {previewValue}
                    </Text>
                </View>
                <Pressable
                    testID="ui-base-virtual-keyboard:key:close"
                    style={({pressed}) => ({
                        position: 'absolute',
                        right: 10,
                        top: 10,
                        minHeight: 34,
                        minWidth: 52,
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: pressed ? '#475569' : overlayColors.previewBorder,
                        backgroundColor: pressed ? '#1e293b' : 'rgba(15, 23, 42, 0.36)',
                        opacity: pressed ? 0.92 : 1,
                    })}
                    onPress={() => runtime?.applyVirtualKey('close')}
                >
                    <Text style={{color: '#f8fafc', fontWeight: '600'}}>关闭</Text>
                </Pressable>
            </View>
            {layout.rows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={{flexDirection: 'row', gap: 8}}>
                    {row.map(key => (
                        <Pressable
                            key={key}
                            testID={`ui-base-virtual-keyboard:key:${key}`}
                            style={({pressed}) => [
                                {
                                    flex: 1,
                                    minHeight: 48,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: isUtilityKey(key)
                                        ? (pressed ? '#475569' : '#334155')
                                        : overlayColors.normalKeyBorder,
                                    backgroundColor: isUtilityKey(key)
                                        ? (pressed ? overlayColors.utilityKeyPressed : overlayColors.utilityKey)
                                        : (pressed ? overlayColors.normalKeyPressed : overlayColors.normalKey),
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    opacity: pressed ? 0.96 : 1,
                                },
                                pressedScaleStyle(pressed, 0.98),
                            ]}
                            onPress={() => {
                                onKeyPress?.(key)
                                runtime?.applyVirtualKey(key)
                            }}
                        >
                            <Text style={{
                                color: isUtilityKey(key) ? '#f8fafc' : '#0f172a',
                                fontWeight: '700',
                            }}
                            >
                                {getKeyLabel(key)}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ))}
            <Pressable
                testID="ui-base-virtual-keyboard:key:enter"
                style={({pressed}) => [
                    {
                        minHeight: 48,
                        borderRadius: 14,
                        backgroundColor: pressed ? overlayColors.primaryKeyPressed : overlayColors.primaryKey,
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: pressed ? 0.96 : 1,
                    },
                    pressedScaleStyle(pressed, 0.99),
                ]}
                onPress={() => {
                    onKeyPress?.('enter')
                    runtime?.applyVirtualKey('enter')
                }}
            >
                <Text style={{color: '#ffffff', fontWeight: '700'}}>{layout.enterLabel ?? '完成'}</Text>
            </Pressable>
        </View>
    )
}
