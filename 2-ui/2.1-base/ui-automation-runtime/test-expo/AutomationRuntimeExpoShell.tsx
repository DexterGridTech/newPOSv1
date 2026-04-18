import React, {useEffect, useMemo, useState} from 'react'
import {Text, View} from 'react-native'
import {createAutomationRuntime} from '../src/application'
import {createBrowserAutomationHost} from '../src/supports'

export const AutomationRuntimeExpoShell: React.FC = () => {
    const runtime = useMemo(() => createAutomationRuntime({
        buildProfile: 'test',
        scriptExecutionAvailable: true,
    }), [])

    const host = useMemo(() => createBrowserAutomationHost({autoStart: false}), [])
    const [hostStarted, setHostStarted] = useState(host.started)

    useEffect(() => {
        host.start()
        setHostStarted(host.started)
        return () => {
            host.stop()
            setHostStarted(host.started)
        }
    }, [host])

    const hello = runtime.hello()

    return (
        <View testID="ui-base-automation-runtime-expo:ready" style={{padding: 24}}>
            <Text>UI Automation Runtime Test Expo</Text>
            <Text testID="ui-base-automation-runtime-expo:protocol">
                {String(hello.protocolVersion)}
            </Text>
            <Text testID="ui-base-automation-runtime-expo:host">
                {String(hostStarted)}
            </Text>
        </View>
    )
}
