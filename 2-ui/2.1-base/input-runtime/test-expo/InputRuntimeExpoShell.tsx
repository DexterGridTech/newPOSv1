import React, {useEffect, useMemo, useState} from 'react'
import {ScrollView, Text, View} from 'react-native'
import {
    InputField,
    InputRuntimeProvider,
    VirtualKeyboardOverlay,
} from '../src'
import {createBrowserAutomationHost} from '../../ui-automation-runtime/src/supports'

const sectionStyle = {
    gap: 8,
    padding: 16,
    borderRadius: 16 as const,
    backgroundColor: '#ffffff',
}

export const InputRuntimeExpoShell: React.FC = () => {
    const [systemText, setSystemText] = useState('system-default')
    const [pin, setPin] = useState('')
    const [amount, setAmount] = useState('12')
    const [activationCode, setActivationCode] = useState('')
    const automationHost = useMemo(() => createBrowserAutomationHost({
        autoStart: false,
        buildProfile: 'test',
        runtimeId: 'input-runtime-expo',
        target: 'primary',
    }), [])

    useEffect(() => {
        automationHost.start()
        return () => {
            automationHost.stop()
        }
    }, [automationHost])

    return (
        <InputRuntimeProvider>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{
                    padding: 20,
                    gap: 16,
                    backgroundColor: '#f4f7fb',
                }}
            >
                <View style={sectionStyle}>
                    <Text selectable style={{fontSize: 24, fontWeight: '700'}}>
                        Input Runtime Test Expo
                    </Text>
                    <Text selectable>
                        验证默认系统键盘和显式虚拟键盘的统一交互模型。
                    </Text>
                </View>

                <View style={sectionStyle}>
                    <Text selectable style={{fontSize: 18, fontWeight: '700'}}>系统文本输入</Text>
                    <InputField
                        testID="ui-base-input-runtime-expo:system-text"
                        value={systemText}
                        onChangeText={setSystemText}
                        placeholder="请输入普通文本"
                    />
                    <Text testID="ui-base-input-runtime-expo:system-text:value">{systemText}</Text>
                </View>

                <View style={sectionStyle}>
                    <Text selectable style={{fontSize: 18, fontWeight: '700'}}>虚拟 PIN</Text>
                    <InputField
                        testID="ui-base-input-runtime-expo:pin"
                        value={pin}
                        onChangeText={setPin}
                        mode="virtual-pin"
                        secureTextEntry
                        maxLength={6}
                        placeholder="请输入 PIN"
                    />
                    <Text testID="ui-base-input-runtime-expo:pin:value">{pin || 'empty'}</Text>
                </View>

                <View style={sectionStyle}>
                    <Text selectable style={{fontSize: 18, fontWeight: '700'}}>虚拟金额</Text>
                    <InputField
                        testID="ui-base-input-runtime-expo:amount"
                        value={amount}
                        onChangeText={setAmount}
                        mode="virtual-amount"
                        placeholder="请输入金额"
                    />
                    <Text testID="ui-base-input-runtime-expo:amount:value">{amount || 'empty'}</Text>
                </View>

                <View style={sectionStyle}>
                    <Text selectable style={{fontSize: 18, fontWeight: '700'}}>虚拟激活码</Text>
                    <InputField
                        testID="ui-base-input-runtime-expo:activation"
                        value={activationCode}
                        onChangeText={setActivationCode}
                        mode="virtual-activation-code"
                        maxLength={6}
                        placeholder="请输入激活码"
                    />
                    <Text testID="ui-base-input-runtime-expo:activation:value">
                        {activationCode || 'empty'}
                    </Text>
                </View>

                <VirtualKeyboardOverlay />
            </ScrollView>
        </InputRuntimeProvider>
    )
}
