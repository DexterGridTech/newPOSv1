import React, {useEffect, useState} from 'react'
import {Provider} from 'react-redux'
import {View, Text} from 'react-native'
import {UiRuntimeProvider} from '@impos2/ui-base-runtime-react'
import {RootScreen} from '@impos2/ui-integration-retail-shell'
import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {createApp, bootstrapAssemblyRuntime, resolveAssemblyTopologyLaunch} from './src/application'
import type {AppProps} from './src/types'

interface AssemblyReadyState {
    runtime: KernelRuntimeV2
    store: EnhancedStore
}

const normalizeProps = (props: Partial<AppProps>): AppProps => ({
    deviceId: props.deviceId ?? 'UNKNOWN-ANDROID-DEVICE',
    screenMode: props.screenMode ?? 'desktop',
    displayCount: props.displayCount ?? 1,
    displayIndex: props.displayIndex ?? 0,
    isEmulator: props.isEmulator ?? false,
    topology: props.topology,
})

export default function App(rawProps: Partial<AppProps>): React.JSX.Element {
    const props = normalizeProps(rawProps)
    const [ready, setReady] = useState<AssemblyReadyState | null>(null)
    const [bootError, setBootError] = useState<string>('')

    useEffect(() => {
        let disposed = false
        void (async () => {
            try {
                const topology = await resolveAssemblyTopologyLaunch(props)
                const resolvedProps: AppProps = {
                    ...props,
                    topology,
                }
                const runtimeApp = createApp(resolvedProps)
                const runtime = await runtimeApp.start()
                await bootstrapAssemblyRuntime(runtime, resolvedProps)
                if (!disposed) {
                    setReady({
                        runtime,
                        store: runtime.getStore(),
                    })
                }
            } catch (error) {
                if (!disposed) {
                    setBootError(error instanceof Error ? error.message : String(error))
                }
            }
        })()
        return () => {
            disposed = true
        }
    }, [props.deviceId, props.displayCount, props.displayIndex, props.isEmulator, props.screenMode, props.topology])

    if (bootError) {
        return (
            <View testID="assembly.android.mixc-retail-rn84:boot-error" style={{flex: 1, padding: 24}}>
                <Text selectable>{bootError}</Text>
            </View>
        )
    }

    if (!ready) {
        return (
            <View testID="assembly.android.mixc-retail-rn84:booting" style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
                <Text>Mixc Retail Assembly Starting...</Text>
            </View>
        )
    }

    return (
        <Provider store={ready.store}>
            <UiRuntimeProvider runtime={ready.runtime}>
                <RootScreen deviceId={props.deviceId} />
            </UiRuntimeProvider>
        </Provider>
    )
}
