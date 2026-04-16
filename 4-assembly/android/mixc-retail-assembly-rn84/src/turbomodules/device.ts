import NativeDeviceTurboModule from './specs/NativeDeviceTurboModule'

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
}
