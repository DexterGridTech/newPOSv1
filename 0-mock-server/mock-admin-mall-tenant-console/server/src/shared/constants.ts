export const APP_NAME = 'mock-admin-mall-tenant-console'
export const SERVER_PORT = Number(process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_PORT ?? 5830)
export const DEFAULT_SANDBOX_ID = process.env.MOCK_ADMIN_MALL_TENANT_CONSOLE_SANDBOX_ID?.trim() || 'sandbox-kernel-base-test'
export const DEFAULT_SOURCE_SERVICE = 'mock-admin-mall-tenant-console'
export const TARGET_TDP_BASE_URL = process.env.MOCK_TERMINAL_PLATFORM_BASE_URL?.trim() || 'http://127.0.0.1:5810'
export const TARGET_TDP_ADMIN_TOKEN = process.env.MOCK_TERMINAL_PLATFORM_ADMIN_TOKEN?.trim() || 'dev-admin-token'
