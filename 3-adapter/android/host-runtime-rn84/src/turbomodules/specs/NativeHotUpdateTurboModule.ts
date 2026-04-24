import { TurboModule, TurboModuleRegistry } from 'react-native'

export interface Spec extends TurboModule {
  downloadPackage(packageId: string, releaseId: string, bundleVersion: string, packageUrlsJson: string, packageSha256: string, manifestSha256: string, packageSize: number): Promise<{
    installDir: string
    entryFile: string
    manifestPath: string
    packageSha256: string
    manifestSha256: string
  }>
  writeBootMarker(releaseId: string, packageId: string, bundleVersion: string, installDir: string, entryFile: string | null, manifestSha256: string, maxLaunchFailures: number, healthCheckTimeoutMs: number | null): Promise<{
    bootMarkerPath: string
  }>
  readActiveMarker(): Promise<Record<string, unknown> | null>
  readBootMarker(): Promise<Record<string, unknown> | null>
  readRollbackMarker(): Promise<Record<string, unknown> | null>
  clearBootMarker(): Promise<void>
  confirmLoadComplete(): Promise<Record<string, unknown> | null>
}

export default TurboModuleRegistry.get<Spec>('HotUpdateTurboModule')
