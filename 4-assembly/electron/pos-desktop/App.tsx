import React, { useCallback, useEffect, useState } from 'react'
import type { Store } from '@reduxjs/toolkit'
import type { Persistor } from 'redux-persist'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { kernelCoreBaseCommands } from '@impos2/kernel-core-base'
import { LoadingScreen } from '@impos2/ui-core-base'
import { RootScreen } from '@impos2/ui-integration-desktop'
import { storePromise } from './src/store'

const App = () => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null)

    const handleAppLoadComplete = useCallback(() => {
        kernelCoreBaseCommands.initialize().executeInternally()
        window.electronBridge.invoke('appControl:onAppLoadComplete').catch((error: Error) => {
            console.error('App load complete error', error)
        })
    }, [])

    useEffect(() => {
        storePromise().then(result => setStoreReady(result))
    }, [])

    if (!storeReady) {
        return <LoadingScreen />
    }

    return (
        <Provider store={storeReady.store}>
            <PersistGate persistor={storeReady.persistor}>
                <RootScreen onLoadComplete={handleAppLoadComplete} />
            </PersistGate>
        </Provider>
    )
}

export default App
