import type { HotUpdatePort } from '@impos2/kernel-base-platform-ports'
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
  clearBootMarker() {
    return nativeHotUpdate.clearBootMarker()
  },
  reportLoadComplete() {
    return Promise.resolve(nativeHotUpdate.confirmLoadComplete()).then(() => undefined)
  },
})
