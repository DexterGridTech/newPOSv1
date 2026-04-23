export const TDP_HOT_UPDATE_TOPIC = 'terminal.hot-update.desired'
export const TDP_HOT_UPDATE_ITEM_KEY = 'main'
export const TDP_HOT_UPDATE_SCHEMA_VERSION = 1

export const HOT_UPDATE_REJECT_REASONS = {
    appIdMismatch: 'APP_ID_MISMATCH',
    platformMismatch: 'PLATFORM_MISMATCH',
    productMismatch: 'PRODUCT_MISMATCH',
    runtimeVersionMismatch: 'RUNTIME_VERSION_MISMATCH',
    assemblyVersionOutOfRange: 'ASSEMBLY_VERSION_OUT_OF_RANGE',
    buildNumberOutOfRange: 'BUILD_NUMBER_OUT_OF_RANGE',
    channelNotAllowed: 'CHANNEL_NOT_ALLOWED',
    missingCapability: 'MISSING_CAPABILITY',
    forbiddenCapability: 'FORBIDDEN_CAPABILITY',
    downgradeNotAllowed: 'DOWNGRADE_NOT_ALLOWED',
} as const
