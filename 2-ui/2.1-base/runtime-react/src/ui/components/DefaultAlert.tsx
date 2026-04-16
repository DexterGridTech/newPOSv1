import React from 'react'
import {Text, View} from 'react-native'
import type {UiAlertInfo} from '@impos2/kernel-base-ui-runtime-v2'

export const DefaultAlert: React.FC<UiAlertInfo> = ({
    title = '提示',
    message = '',
}) => (
    <View testID="ui-base-default-alert">
        <Text>{title}</Text>
        <Text>{message}</Text>
    </View>
)
