import { buildHotUpdateVersionReportPayload } from '@impos2/kernel-base-tdp-sync-runtime-v2'
import type { KernelRuntimeV2 } from '@impos2/kernel-base-runtime-shell-v2'
import {
  resolveTransportServers,
  selectTransportSelectedServerSpace,
  type TransportServerAddress,
} from '@impos2/kernel-base-transport-runtime'
import type { AppProps } from '../types'
import { createAssemblyFetchTransport } from '../platform-ports'
import {
  kernelBaseDevServerConfig,
  SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@impos2/kernel-server-config-v2'
import {getHostRuntimeReleaseInfo} from './releaseInfoContext'
import {
  enqueueTerminalVersionReport,
  flushTerminalVersionReportOutbox,
  type TerminalVersionReportOutboxItem,
} from './versionReportOutbox'

const isLoopbackHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase()
  return normalized === '127.0.0.1'
    || normalized === 'localhost'
    || normalized === '10.0.2.2'
}

const scoreMockTerminalPlatformAddress = (
  baseUrl: string,
  addressName: string | undefined,
  isEmulator: boolean,
): number => {
  let score = 0
  try {
    const url = new URL(baseUrl)
    const loopback = isLoopbackHost(url.hostname)
    score += isEmulator === loopback ? 100 : 0
  } catch {
    return -1
  }

  const normalizedAddressName = addressName?.trim().toLowerCase()
  if (isEmulator) {
    if (normalizedAddressName === 'local') {
      score += 20
    } else if (normalizedAddressName === 'localhost') {
      score += 10
    }
  } else if (normalizedAddressName === 'lan') {
    score += 20
  }

  return score
}

const resolveMockTerminalPlatformAddresses = (
  runtime: KernelRuntimeV2,
  isEmulator: boolean,
): TransportServerAddress[] => {
  const resolvedAddresses = resolveTransportServers(kernelBaseDevServerConfig, {
    selectedSpace: selectTransportSelectedServerSpace(runtime.getState())
      ?? kernelBaseDevServerConfig.selectedSpace,
  })
    .find(server => server.serverName === SERVER_NAME_MOCK_TERMINAL_PLATFORM)
    ?.addresses
    ?? []

  const sortedAddresses = [...resolvedAddresses]
    .filter(address => typeof address.baseUrl === 'string' && address.baseUrl.length > 0)
    .sort((left, right) =>
      scoreMockTerminalPlatformAddress(right.baseUrl, right.addressName, isEmulator)
      - scoreMockTerminalPlatformAddress(left.baseUrl, left.addressName, isEmulator))

  const fallbackAddresses: TransportServerAddress[] = isEmulator
    ? [
      {
        addressName: 'emulator-host-loopback',
        baseUrl: 'http://10.0.2.2:5810',
        timeoutMs: 3_000,
      },
      {
        addressName: 'emulator-adb-reverse',
        baseUrl: 'http://127.0.0.1:5810',
        timeoutMs: 3_000,
      },
    ]
    : [
      {
        addressName: 'device-localhost',
        baseUrl: 'http://127.0.0.1:5810',
        timeoutMs: 3_000,
      },
    ]

  const mergedAddresses = [...sortedAddresses]
  for (const address of fallbackAddresses) {
    if (mergedAddresses.some(item => item.baseUrl === address.baseUrl)) {
      continue
    }
    mergedAddresses.push(address)
  }

  return mergedAddresses
}

export const reportTerminalVersion = async (
  runtime: KernelRuntimeV2,
  props: AppProps,
  state: 'BOOTING' | 'RUNNING' | 'FAILED' | 'ROLLED_BACK',
  reason?: string,
) => {
  const releaseInfo = getHostRuntimeReleaseInfo()
  const report = buildHotUpdateVersionReportPayload(runtime.getState(), {
    appId: releaseInfo.appId,
    assemblyVersion: releaseInfo.assemblyVersion,
    buildNumber: releaseInfo.buildNumber,
    runtimeVersion: releaseInfo.runtimeVersion,
    displayIndex: props.displayIndex,
    displayRole: props.displayCount > 1 ? (props.displayIndex === 0 ? 'primary' : 'secondary') : 'single',
    state,
    reason,
  })
  if (!report) {
    return
  }

  const itemId = [
    report.terminalId,
    props.displayIndex,
    report.payload.source,
    report.payload.bundleVersion,
    report.payload.packageId ?? '',
    report.payload.releaseId ?? '',
    state,
    reason ?? '',
  ].join('|')
  await enqueueTerminalVersionReport({
    id: itemId,
    terminalId: report.terminalId,
    sandboxId: report.sandboxId,
    payload: {
      ...(report.payload as Record<string, unknown>),
      isEmulator: props.isEmulator,
    },
  })
  await flushTerminalVersionReportOutbox(item => sendTerminalVersionReport(runtime, item))
}

const sendTerminalVersionReport = async (
  runtime: KernelRuntimeV2,
  item: TerminalVersionReportOutboxItem,
): Promise<void> => {
  const {isEmulator: rawIsEmulator, ...payload} = item.payload
  const addresses = resolveMockTerminalPlatformAddresses(runtime, rawIsEmulator === true)
  const transport = createAssemblyFetchTransport()
  let lastError: unknown

  for (const [attemptIndex, address] of addresses.entries()) {
    try {
      await transport.execute({
        endpoint: {
          protocol: 'http',
          name: 'report-terminal-version',
          serverName: 'mock-terminal-platform',
          method: 'POST',
          pathTemplate: `/api/v1/terminals/${item.terminalId}/version-reports`,
          request: {},
          response: { kind: 'type-descriptor', name: 'version-report-response' },
        },
        input: {
          body: {
            sandboxId: item.sandboxId,
            ...payload,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        },
        url: `${address.baseUrl}/api/v1/terminals/${item.terminalId}/version-reports`,
        selectedAddress: address,
        attemptIndex,
        roundIndex: 0,
      })
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('report-terminal-version failed for every mock-terminal-platform address')
}
