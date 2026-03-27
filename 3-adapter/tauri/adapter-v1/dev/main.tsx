import React, {useEffect, useState} from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { storePromise } from './store'
import { DevHome } from '@impos2/ui-core-adapter-test'
import type {Store} from "@reduxjs/toolkit"
import type {Persistor} from "redux-persist"
import {PersistGate} from "redux-persist/integration/react"
import {ApplicationManager} from "@impos2/kernel-core-base"

const App = () => {
    const [storeReady, setStoreReady] = useState<{ store: Store; persistor: Persistor } | null>(null)

    useEffect(() => {
        console.log('Starting store initialization...')
        storePromise().then(result => {
            console.log('Store initialized successfully:', result)
            setStoreReady(result)
        }).catch(error => {
            console.error('Store initialization failed:', error)
        })
    }, [])

    if (!storeReady) {
        return <div>Loading...</div>
    }

    return (
        <Provider store={storeReady.store}>
            <PersistGate persistor={storeReady.persistor} onBeforeLift={() => {
                ApplicationManager.getInstance().init()
            }}>
                <DevHome />
            </PersistGate>
        </Provider>
    )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
)
