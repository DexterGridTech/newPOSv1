import React from 'react'
import {
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native'

export interface ExpoTestWatermarkItem {
    label: string
    value: string | number | null | undefined
    testID?: string
}

export interface ExpoTestWatermarkProps {
    title: string
    items: readonly ExpoTestWatermarkItem[]
    testID?: string
    style?: StyleProp<ViewStyle>
    titleStyle?: StyleProp<TextStyle>
    valueStyle?: StyleProp<TextStyle>
    labelStyle?: StyleProp<TextStyle>
}

const stringifyWatermarkValue = (
    value: ExpoTestWatermarkItem['value'],
): string => value == null ? '' : String(value)

export const ExpoTestWatermark: React.FC<ExpoTestWatermarkProps> = ({
    items,
    labelStyle,
    style,
    testID,
    title,
    titleStyle,
    valueStyle,
}) => (
    <View
        testID={testID}
        style={[styles.root, style]}
        pointerEvents="none"
    >
        <Text style={[styles.title, titleStyle]}>
            {title}
        </Text>
        {items.map(item => (
            <View
                key={`${item.label}:${item.testID ?? item.label}`}
                style={styles.row}
            >
                <Text
                    selectable
                    testID={item.testID}
                    style={[styles.value, valueStyle]}
                >
                    {stringifyWatermarkValue(item.value)}
                </Text>
                <Text style={[styles.label, labelStyle]}>
                    {`: ${item.label}`}
                </Text>
            </View>
        ))}
    </View>
)

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        right: 12,
        top: 10,
        maxWidth: '46%',
        opacity: 0.28,
        alignItems: 'flex-end',
        gap: 2,
    },
    title: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'right',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        maxWidth: '100%',
    },
    value: {
        fontSize: 10,
        lineHeight: 13,
        color: '#0f172a',
        textAlign: 'right',
        flexShrink: 1,
    },
    label: {
        fontSize: 10,
        lineHeight: 13,
        color: '#0f172a',
        textAlign: 'right',
    },
})
