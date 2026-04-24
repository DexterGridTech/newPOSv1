#!/usr/bin/env node

import {spawnSync} from 'node:child_process'
import {dirname, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const KERNEL_BASE_TEST_SANDBOX_ID = 'sandbox-kernel-base-test'
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')

let cachedDefaultBaseUrl = null
let cachedCandidateBaseUrls = null

function preferHostReachableBaseUrl(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return ''
  }

  const scoredAddresses = addresses
    .map((item, index) => {
      const baseUrl =
        typeof item === 'string'
          ? item.trim()
          : item?.baseUrl?.trim() ?? ''
      if (!baseUrl) {
        return null
      }

      let score = 0
      try {
        const url = new URL(baseUrl)
        const hostname = url.hostname.toLowerCase()
        if (hostname === '127.0.0.1' || hostname === 'localhost') {
          score += 100
        }
        if (
          typeof item !== 'string'
          && (item?.addressName === 'local' || item?.addressName === 'localhost')
        ) {
          score += 10
        }
      } catch {
        // Keep invalid URLs last and let the existing error handling report them if selected.
      }

      return {
        baseUrl,
        score,
        index,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.index - right.index)

  return scoredAddresses[0]?.baseUrl ?? ''
}

export function resolveDefaultMockTerminalPlatformBaseUrlCandidates() {
  if (cachedCandidateBaseUrls) {
    return cachedCandidateBaseUrls
  }

  const devConfigModuleUrl = pathToFileURL(
    resolve(repoRoot, '1-kernel/server-config-v2/src/dev.ts'),
  ).href
  const serverNameModuleUrl = pathToFileURL(
    resolve(repoRoot, '1-kernel/server-config-v2/src/serverName.ts'),
  ).href
  const resolveScript = `
    const devConfigModule = await import(${JSON.stringify(devConfigModuleUrl)});
    const serverNameModule = await import(${JSON.stringify(serverNameModuleUrl)});
    const kernelBaseDevServerConfig =
      devConfigModule.kernelBaseDevServerConfig
      ?? devConfigModule.default?.kernelBaseDevServerConfig
      ?? devConfigModule['module.exports']?.kernelBaseDevServerConfig;
    const mockServerName =
      serverNameModule.SERVER_NAME_MOCK_TERMINAL_PLATFORM
      ?? serverNameModule.default?.SERVER_NAME_MOCK_TERMINAL_PLATFORM
      ?? serverNameModule['module.exports']?.SERVER_NAME_MOCK_TERMINAL_PLATFORM;
    const matchedServer = kernelBaseDevServerConfig?.spaces
      ?.flatMap(space => space.servers ?? [])
      ?.find(server => server.serverName === mockServerName);
    const baseUrls = matchedServer?.addresses
      ?.map(item => item?.baseUrl?.trim())
      ?.filter(Boolean);
    if (!baseUrls?.length) {
      throw new Error('Mock terminal platform baseUrl not found in 1-kernel/server-config-v2');
    }
    console.log(JSON.stringify(baseUrls));
  `
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--eval', resolveScript],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )
  if (result.error) {
    fail(
      'Failed to resolve mock platform baseUrl from 1-kernel/server-config-v2',
      result.error.message,
    )
  }
  if (result.status !== 0) {
    fail(
      'Failed to resolve mock platform baseUrl from 1-kernel/server-config-v2',
      [result.stdout, result.stderr].filter(Boolean).join('\n'),
    )
  }

  cachedCandidateBaseUrls = JSON.parse(result.stdout.trim())
  return cachedCandidateBaseUrls
}

export function resolveDefaultMockTerminalPlatformBaseUrl() {
  if (cachedDefaultBaseUrl) {
    return cachedDefaultBaseUrl
  }

  cachedDefaultBaseUrl = preferHostReachableBaseUrl(
    resolveDefaultMockTerminalPlatformBaseUrlCandidates(),
  )
  if (!cachedDefaultBaseUrl) {
    fail('Failed to resolve mock platform baseUrl from 1-kernel/server-config-v2')
  }
  return cachedDefaultBaseUrl
}

function fail(message, detail) {
  if (message) {
    console.error(message)
  }
  if (detail) {
    console.error(detail)
  }
  process.exit(1)
}

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.MOCK_TERMINAL_PLATFORM_BASE_URL?.trim() || resolveDefaultMockTerminalPlatformBaseUrl(),
    sandboxId: '',
    storeId: '',
    count: 1,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--base-url':
        options.baseUrl = argv[++index] ?? options.baseUrl
        break
      case '--sandbox-id':
        options.sandboxId = argv[++index] ?? ''
        break
      case '--store-id':
        options.storeId = argv[++index] ?? ''
        break
      case '--count':
        options.count = Number(argv[++index] ?? 1)
        break
      default:
        break
    }
  }

  return options
}

async function requestJson(baseUrl, pathname, init) {
  const response = await fetch(new URL(pathname, baseUrl), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    const errorMessage = payload?.error?.message ?? `${response.status} ${response.statusText}`
    throw new Error(errorMessage)
  }
  return payload.data
}

async function prepareKernelBaseTestSandbox(baseUrl) {
  return await requestJson(baseUrl, '/mock-debug/kernel-base-test/prepare', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

async function getRuntimeContext(baseUrl) {
  return await requestJson(baseUrl, '/api/v1/admin/runtime-context')
}

async function listSandboxes(baseUrl) {
  return await requestJson(baseUrl, '/api/v1/admin/sandboxes')
}

async function listActivationCodes(baseUrl, sandboxId) {
  const url = new URL('/api/v1/admin/activation-codes', baseUrl)
  url.searchParams.set('sandboxId', sandboxId)
  const response = await fetch(url)
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    const errorMessage = payload?.error?.message ?? `${response.status} ${response.statusText}`
    throw new Error(errorMessage)
  }
  return payload.data
}

async function createActivationCodes(baseUrl, sandboxId, count, storeId = '') {
  return await requestJson(baseUrl, '/api/v1/admin/activation-codes/batch', {
    method: 'POST',
    body: JSON.stringify({
      sandboxId,
      count,
      ...(storeId ? {storeId} : {}),
    }),
  })
}

function selectAvailableActivationCode(codes, storeId = '') {
  return codes.find(item => item?.status === 'AVAILABLE' && (!storeId || item?.storeId === storeId || item?.store_id === storeId)) ?? null
}

export async function prepareActivation(options) {
  const baseUrl = options.baseUrl || resolveDefaultMockTerminalPlatformBaseUrl()
  let sandboxId = options.sandboxId?.trim()
  let preparedKernelSandbox = false

  if (!sandboxId) {
    const runtimeContext = await getRuntimeContext(baseUrl)
    sandboxId = runtimeContext.currentSandboxId
  }

  let sandboxes = await listSandboxes(baseUrl)
  let sandbox = sandboxes.find(item => item.sandboxId === sandboxId)

  if (!sandbox && sandboxId === KERNEL_BASE_TEST_SANDBOX_ID) {
    await prepareKernelBaseTestSandbox(baseUrl)
    preparedKernelSandbox = true
    sandboxes = await listSandboxes(baseUrl)
    sandbox = sandboxes.find(item => item.sandboxId === sandboxId)
  }

  if (!sandbox) {
    throw new Error(`sandbox not found: ${sandboxId}`)
  }

  let codes = await listActivationCodes(baseUrl, sandboxId)
  const storeId = options.storeId?.trim() ?? ''
  let activation = selectAvailableActivationCode(codes, storeId)
  let created = false

  if (!activation) {
    await createActivationCodes(baseUrl, sandboxId, Math.max(1, options.count || 1), storeId)
    created = true
    codes = await listActivationCodes(baseUrl, sandboxId)
    activation = selectAvailableActivationCode(codes, storeId)
  }

  if (!activation) {
    throw new Error(`no available activation code for sandbox: ${sandboxId}`)
  }

  return {
    baseUrl,
    sandboxId,
    storeId: activation.storeId ?? activation.store_id ?? storeId,
    activationCode: activation.code,
    created,
    preparedKernelSandbox,
  }
}

async function main() {
  try {
    const result = await prepareActivation(parseArgs(process.argv.slice(2)))
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    fail(
      'Failed to prepare mock-platform activation',
      error instanceof Error ? error.stack ?? error.message : String(error),
    )
  }
}

const isMainModule = import.meta.url === new URL(process.argv[1], 'file:').href

if (isMainModule) {
  await main()
}
