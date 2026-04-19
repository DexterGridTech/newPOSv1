export interface HotUpdateCompatibilityDto {
  appId: string
  platform: string
  product: string
  runtimeVersion: string
  channel?: string
  minAssemblyVersion?: string
  maxAssemblyVersion?: string
  minBuildNumber?: number
  maxBuildNumber?: number
  allowedChannels?: string[]
  targetPackages?: Record<string, string>
}

export interface HotUpdateRestartPolicyDto {
  mode: 'immediate' | 'idle' | 'manual' | 'next-launch'
  operatorInstruction?: string
}

export interface HotUpdateManifestDto {
  manifestVersion: 1
  packageId?: string
  appId: string
  platform: 'android' | 'electron'
  product: string
  channel: string
  bundleVersion: string
  runtimeVersion: string
  assemblyVersion: string
  buildNumber: number
  builtAt: string
  git: {
    commit: string
    branch: string
    dirty?: boolean
  }
  compatibility: HotUpdateCompatibilityDto
  package: {
    type: 'full-js-bundle' | 'electron-webpack-bundle'
    entry: string
    assetsDir?: string
    sourceMap?: string
    compression: 'zip'
    size: number
    sha256: string
    files?: Array<{
      path: string
      size: number
      sha256: string
    }>
  }
  install: {
    strategy: 'replace-bundle'
    requiresRuntimeRestart: boolean
    maxRetainedPackages: number
  }
  restart: HotUpdateRestartPolicyDto
  rollout: {
    defaultStrategy: 'manual-policy'
    notes?: string
  }
  security: {
    hashAlgorithm: 'sha256'
    signatureAlgorithm?: 'ed25519'
    signature?: string
    signer?: string
  }
  releaseNotes?: string[]
  artifacts?: Array<{
    name: string
    path: string
    size?: number
    sha256?: string
    modifiedAt?: string
  }>
}

export interface HotUpdateDesiredPayloadDto {
  schemaVersion: 1
  releaseId: string
  packageId: string
  appId: string
  platform: 'android' | 'electron'
  product: string
  bundleVersion: string
  runtimeVersion: string
  packageUrl: string
  packageSize: number
  packageSha256: string
  manifestSha256: string
  compatibility: HotUpdateCompatibilityDto
  restart: HotUpdateRestartPolicyDto
  rollout: {
    mode: 'active' | 'paused' | 'rollback'
    publishedAt: string
    expiresAt?: string
    allowDowngrade?: boolean
  }
  safety: {
    requireSignature: boolean
    maxDownloadAttempts: number
    maxLaunchFailures: number
    healthCheckTimeoutMs: number
  }
  metadata?: Record<string, unknown>
}
