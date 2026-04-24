import type { HotUpdatePort } from '@next/kernel-base-platform-ports'
import { nativeHotUpdate } from '../turbomodules/hotUpdate'

export const createAssemblyHotUpdatePort = (): HotUpdatePort => ({
  downloadPackage(input) {
    return nativeHotUpdate.downloadPackage(input)
  },
  writeBootMarker(input) {
    return nativeHotUpdate.writeBootMarker(input)
  },
  readBootMarker() {
    return nativeHotUpdate.readBootMarker()
  },
  readActiveMarker() {
    return nativeHotUpdate.readActiveMarker()
  },
  readRollbackMarker() {
    return nativeHotUpdate.readRollbackMarker()
  },
  clearBootMarker() {
    return nativeHotUpdate.clearBootMarker()
  },
  confirmLoadComplete() {
    return nativeHotUpdate.confirmLoadComplete()
  },
  reportLoadComplete() {
    return Promise.resolve(nativeHotUpdate.confirmLoadComplete()).then(() => undefined)
  },
})
