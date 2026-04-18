import type {StoreEnhancer} from '@reduxjs/toolkit'
import Reactotron from 'reactotron-react-native'
import {reactotronRedux} from 'reactotron-redux'
import packageJson from '../../package.json'

type ReactotronPackageConfig = {
    emulatorHost?: string
    deviceHost?: string
}

type PackageJsonWithReactotron = {
    reactotron?: ReactotronPackageConfig
}

type ReactotronInstance = ReturnType<typeof Reactotron.configure>

export type ReactotronSessionOptions = {
    isEmulator: boolean
    displayIndex: number
    deviceId: string
}

const reactotronPackageConfig = (packageJson as PackageJsonWithReactotron).reactotron ?? {}

let reactotronInstance: ReactotronInstance | null = null
let currentHost: string | null = null
let currentClientName: string | null = null

const buildReactotronClientName = (
    input: Pick<ReactotronSessionOptions, 'displayIndex' | 'deviceId'>,
): string => {
    const screenLabel = input.displayIndex === 0 ? 'Main' : `Secondary-${input.displayIndex}`
    return `IMPos2 Desktop V1 ${screenLabel} ${input.deviceId}`
}

export const resolveReactotronHost = (isEmulator: boolean): string => {
    if (isEmulator) {
        return reactotronPackageConfig.emulatorHost ?? 'localhost'
    }
    return reactotronPackageConfig.deviceHost ?? '192.168.0.172'
}

export const getReactotron = (
    input: ReactotronSessionOptions,
): ReactotronInstance => {
    const host = resolveReactotronHost(input.isEmulator)
    const clientName = buildReactotronClientName(input)
    if (reactotronInstance && currentHost === host && currentClientName === clientName) {
        console.info(`[Reactotron] reuse host=${host} isEmulator=${input.isEmulator} name=${clientName}`)
        return reactotronInstance
    }

    if (reactotronInstance) {
        reactotronInstance.close()
    }

    console.info(`[Reactotron] connect host=${host} isEmulator=${input.isEmulator} name=${clientName}`)

    reactotronInstance = Reactotron
        .configure({name: clientName, host})
        .useReactNative({
            asyncStorage: false,
            networking: {ignoreUrls: /symbolicate/},
            editor: false,
            errors: {veto: () => false},
            overlay: false,
        })
        .use(reactotronRedux())
        .connect()

    currentHost = host
    currentClientName = clientName

    if (__DEV__) {
        ;(console as typeof console & {tron?: ReactotronInstance}).tron = reactotronInstance
    }

    return reactotronInstance
}

export const createReactotronEnhancer = (
    input: ReactotronSessionOptions,
): StoreEnhancer | undefined => {
    const reactotron = getReactotron(input)
    return (reactotron as ReactotronInstance & {createEnhancer?: () => StoreEnhancer}).createEnhancer?.()
}
