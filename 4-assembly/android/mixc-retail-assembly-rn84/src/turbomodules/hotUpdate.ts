import NativeHotUpdateTurboModule from './specs/NativeHotUpdateTurboModule'

export const nativeHotUpdate = {
  downloadPackage(input: {
    packageId: string
    releaseId: string
    bundleVersion: string
    packageUrls: readonly string[]
    packageSha256: string
    manifestSha256: string
    packageSize: number
  }) {
    if (!NativeHotUpdateTurboModule?.downloadPackage) {
      return Promise.reject(new Error('HOT_UPDATE_MODULE_UNAVAILABLE'))
    }
    return NativeHotUpdateTurboModule.downloadPackage(
      input.packageId,
      input.releaseId,
      input.bundleVersion,
      JSON.stringify(input.packageUrls),
      input.packageSha256,
      input.manifestSha256,
      input.packageSize,
    )
  },
  writeBootMarker(input: {
    releaseId: string
    packageId: string
    bundleVersion: string
    installDir: string
    entryFile?: string
    manifestSha256: string
    maxLaunchFailures: number
  }) {
    if (!NativeHotUpdateTurboModule?.writeBootMarker) {
      return Promise.reject(new Error('HOT_UPDATE_MODULE_UNAVAILABLE'))
    }
    return NativeHotUpdateTurboModule.writeBootMarker(
      input.releaseId,
      input.packageId,
      input.bundleVersion,
      input.installDir,
      input.entryFile ?? null,
      input.manifestSha256,
      input.maxLaunchFailures,
    )
  },
  readActiveMarker() {
    return NativeHotUpdateTurboModule?.readActiveMarker?.() ?? Promise.resolve(null)
  },
  readBootMarker() {
    return NativeHotUpdateTurboModule?.readBootMarker?.() ?? Promise.resolve(null)
  },
  readRollbackMarker() {
    return NativeHotUpdateTurboModule?.readRollbackMarker?.() ?? Promise.resolve(null)
  },
  clearBootMarker() {
    return NativeHotUpdateTurboModule?.clearBootMarker?.() ?? Promise.resolve()
  },
  confirmLoadComplete() {
    return NativeHotUpdateTurboModule?.confirmLoadComplete?.() ?? Promise.resolve(null)
  },
}
