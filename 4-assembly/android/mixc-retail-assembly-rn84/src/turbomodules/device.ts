import {NativeEventEmitter} from 'react-native'
import NativeDeviceTurboModule from './specs/NativeDeviceTurboModule'

const emitter = new NativeEventEmitter(NativeDeviceTurboModule as any)

export const nativeDevice = {
    async getDeviceId(): Promise<string> {
        const info = await NativeDeviceTurboModule.getDeviceInfo()
        return String(info.id ?? 'UNKNOWN-ANDROID-DEVICE')
    },
    async getPlatform(): Promise<string> {
        return 'android'
    },
    async getModel(): Promise<string> {
        const info = await NativeDeviceTurboModule.getDeviceInfo()
        return String(info.manufacturer ?? 'Android')
    },
    getDeviceInfo() {
        return NativeDeviceTurboModule.getDeviceInfo()
    },
    getSystemStatus() {
        return NativeDeviceTurboModule.getSystemStatus()
    },
    addPowerStatusChangeListener(listener: (event: Record<string, unknown>) => void): () => void {
        let subscription: {remove: () => void} | null = null
        let listenerId: string | null = null
        let disposed = false

        const bind = async () => {
            listenerId = await NativeDeviceTurboModule.addPowerStatusChangeListener()
            if (disposed) {
                await NativeDeviceTurboModule.removePowerStatusChangeListener(listenerId)
                return
            }
            subscription = emitter.addListener('onPowerStatusChanged', listener)
        }

        void bind()

        return () => {
            disposed = true
            subscription?.remove()
            subscription = null
            if (listenerId) {
                void NativeDeviceTurboModule.removePowerStatusChangeListener(listenerId)
                listenerId = null
            }
        }
    },
}
