import React from 'react'
import {ActivityIndicator, Text, View} from 'react-native'

export interface LoadingScreenProps {
    label?: string
    testID?: string
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    label = '正在加载',
    testID = 'ui-base-runtime-react:loading-screen',
}) => (
    <View
        testID={testID}
        style={{
            flex: 1,
            minHeight: 180,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: '#d7e1ec',
            backgroundColor: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
        }}
    >
        <ActivityIndicator size="large" color="#0b5fff" />
        <Text style={{color: '#64748b', fontSize: 13, fontWeight: '700'}}>
            {label}
        </Text>
    </View>
)
