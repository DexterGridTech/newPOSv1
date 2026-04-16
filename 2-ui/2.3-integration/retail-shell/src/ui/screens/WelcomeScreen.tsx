import React from 'react'
import {Text, View} from 'react-native'
import type {RetailWelcomeScreenProps} from '../../types'

export const WelcomeScreen: React.FC<RetailWelcomeScreenProps> = ({
    terminalId,
}) => {
    return (
        <View
            testID="ui-integration-retail-shell:welcome"
            style={{
                flex: 1,
                padding: 24,
                justifyContent: 'center',
                backgroundColor: '#eef4fb',
            }}
        >
            <View
                style={{
                    borderRadius: 28,
                    backgroundColor: '#ffffff',
                    padding: 24,
                    gap: 18,
                    borderWidth: 1,
                    borderColor: '#dbe7f3',
                }}
            >
                <View style={{gap: 8}}>
                    <Text
                        testID="ui-integration-retail-shell:welcome:eyebrow"
                        style={{fontSize: 12, fontWeight: '800', color: '#2563eb'}}
                    >
                        RETAIL SHELL
                    </Text>
                    <Text
                        testID="ui-integration-retail-shell:welcome:title"
                        style={{fontSize: 30, lineHeight: 38, fontWeight: '800', color: '#0f172a'}}
                    >
                        欢迎进入零售终端
                    </Text>
                    <Text
                        testID="ui-integration-retail-shell:welcome:subtitle"
                        style={{fontSize: 15, lineHeight: 22, color: '#475569'}}
                    >
                        terminal-console 已完成终端激活，integration shell 只负责呈现本业务欢迎页和后续业务入口承载。
                    </Text>
                </View>

                <View
                    style={{
                        borderRadius: 18,
                        backgroundColor: '#f8fbff',
                        padding: 16,
                        gap: 8,
                    }}
                >
                    <Text style={{fontSize: 12, color: '#64748b', fontWeight: '700'}}>当前终端</Text>
                    <Text
                        selectable
                        testID="ui-integration-retail-shell:welcome:terminal-id"
                        style={{fontSize: 22, fontWeight: '800', color: '#0f172a'}}
                    >
                        {terminalId ?? 'terminal:unactivated'}
                    </Text>
                </View>

                <View style={{gap: 10}}>
                    <Text style={{fontSize: 13, fontWeight: '700', color: '#334155'}}>当前壳层职责</Text>
                    <Text
                        testID="ui-integration-retail-shell:welcome:summary"
                        style={{fontSize: 14, lineHeight: 22, color: '#475569'}}
                    >
                        RootScreen 只做 host shell，真正的主内容切换依旧来自 ui-runtime screen part 路由。后续不同品牌或业务 integration 只需要替换欢迎页和业务主屏，不需要复制激活流程。
                    </Text>
                </View>
            </View>
        </View>
    )
}
