import React from 'react'
import {Text, View} from 'react-native'
import {InputField, inputRuntimeDefaultFields} from '@impos2/ui-base-input-runtime'
import {useUiRuntime} from '@impos2/ui-base-runtime-react'
import {useDeviceActivation} from '../../hooks/useDeviceActivation'
import {
    TerminalActionButton,
    TerminalInfoList,
    TerminalInlineMessage,
    TerminalScreenShell,
} from '../components/TerminalSectionPrimitives'

export const ActivateDeviceScreen: React.FC = () => {
    const runtime = useUiRuntime()
    const model = useDeviceActivation(runtime)

    return (
        <TerminalScreenShell
            testID="ui-base-terminal-activate-device"
            badge="终端接入"
            title="设备激活"
            subtitle="输入管理员提供的激活码后，终端会自动向平台申请终端身份和凭证。"
        >
            <View style={{gap: 12}}>
                <Text style={{fontSize: 13, fontWeight: '700', color: '#526072'}}>激活码</Text>
                <InputField
                    testID="ui-base-terminal-activate-device:input"
                    value={model.activationCode}
                    onChangeText={model.setActivationCode}
                    mode="virtual-activation-code"
                    placeholder="请输入激活码"
                />
                <Text
                    testID="ui-base-terminal-activate-device:value"
                    selectable
                    style={{fontSize: 13, color: '#7a8aa0'}}
                >
                    当前输入：{model.activationCode || '未输入'}
                </Text>
            </View>

            <TerminalInfoList
                items={[
                    {
                        key: 'rule-length',
                        label: '规则',
                        value: '激活码长度至少 6 位，允许字母数字混合',
                    },
                    {
                        key: 'rule-submit',
                        label: '提交流程',
                        value: '提交后会同步请求平台，下发终端号和访问凭证',
                    },
                ]}
            />

            <TerminalInlineMessage
                testID="ui-base-terminal-activate-device:message"
                tone={model.errorMessage ? 'error' : 'info'}
                message={model.errorMessage ?? '未激活时，欢迎页和业务入口不会显示。'}
            />

            <TerminalActionButton
                testID="ui-base-terminal-activate-device:submit"
                label={model.isSubmitting ? '激活中...' : '立即激活'}
                disabled={!model.canSubmit}
                onPress={() => {
                    void model.submit()
                }}
            />
        </TerminalScreenShell>
    )
}
