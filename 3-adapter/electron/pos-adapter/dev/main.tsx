import React, { useEffect, useState } from 'react'
import { AppRegistry, View, Text } from 'react-native'
import { Provider } from 'react-redux'
import type { Store } from '@reduxjs/toolkit'
import type { Persistor } from 'redux-persist'
import { PersistGate } from 'redux-persist/integration/react'
import { kernelCoreBaseCommands } from '@impos2/kernel-core-base'
import { storePromise } from './store'
import DevHome from './screens/DevHome'

const App = () => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null)

    useEffect(() => {
        storePromise().then(result => setStoreReady(result))
    }, [])

    if (!storeReady) {
        return (
            <View>
                <Text>Loading</Text>
            </View>
        )
    }

    return (
        <Provider store={storeReady.store}>
            <PersistGate persistor={storeReady.persistor} onBeforeLift={() => {
                kernelCoreBaseCommands.initialize().executeInternally()
            }}>
                <DevHome />
            </PersistGate>
        </Provider>
    )
}

AppRegistry.registerComponent('AdapterElectronDev', () => App)
AppRegistry.runApplication('AdapterElectronDev', {
    rootTag: document.getElementById('app'),
})
