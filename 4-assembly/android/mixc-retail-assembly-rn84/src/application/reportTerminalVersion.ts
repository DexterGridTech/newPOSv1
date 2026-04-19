import { buildHotUpdateVersionReportPayload } from '@impos2/kernel-base-tdp-sync-runtime-v2'
import type { KernelRuntimeV2 } from '@impos2/kernel-base-runtime-shell-v2'
import type { AppProps } from '../types'
import { createAssemblyFetchTransport, resolveAssemblyTransportServers } from '../platform-ports'
import { SERVER_NAME_MOCK_TERMINAL_PLATFORM } from '@impos2/kernel-server-config-v2'
import { releaseInfo } from '../generated/releaseInfo'

const resolveMockTerminalPlatformBaseUrl = (): string =>
  resolveAssemblyTransportServers()
    .find(server => server.serverName === SERVER_NAME_MOCK_TERMINAL_PLATFORM)
    ?.addresses[0]?.baseUrl
  ?? 'http://10.0.2.2:5810'

export const reportTerminalVersion = async (
  runtime: KernelRuntimeV2,
  props: AppProps,
  state: 'BOOTING' | 'RUNNING' | 'FAILED' | 'ROLLED_BACK',
  reason?: string,
) => {
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

  const baseUrl = resolveMockTerminalPlatformBaseUrl()
  const transport = createAssemblyFetchTransport()
  await transport.execute({
    endpoint: {
      protocol: 'http',
      name: 'report-terminal-version',
      serverName: 'mock-terminal-platform',
      method: 'POST',
      pathTemplate: `/api/v1/terminals/${report.terminalId}/version-reports`,
      request: {},
      response: { kind: 'type-descriptor', name: 'version-report-response' },
    },
    input: {
      body: {
        sandboxId: report.sandboxId,
        ...report.payload,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    },
    url: `${baseUrl}/api/v1/terminals/${report.terminalId}/version-reports`,
    selectedAddress: {
      addressName: 'mock-terminal-platform',
      baseUrl,
    },
    attemptIndex: 0,
    roundIndex: 0,
  })
}
