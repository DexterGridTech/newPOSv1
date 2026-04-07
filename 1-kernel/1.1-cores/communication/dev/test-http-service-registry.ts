import {
  defineHttpEndpoint,
  defineHttpServiceModule,
  httpServiceRegistry,
  HttpRuntime,
  typed,
} from '../src'

interface ActivateDevicePath {
  deviceId: string
}

interface ActivateDeviceBody {
  operatorId: string
}

interface ActivateDeviceResponse {
  deviceId: string
  activated: boolean
  body: ActivateDeviceBody
}

interface TerminalHttpServices {
  device: {
    activate(input: {deviceId: string; body: ActivateDeviceBody}): Promise<ActivateDeviceResponse>
  }
}

export async function testHttpServiceRegistry() {
  httpServiceRegistry.clear()

  const runtime = new HttpRuntime({
    servers: [
      {
        serverName: 'communicationServiceHttp',
        addresses: [{addressName: 'service-local', baseURL: 'http://localhost:6190', timeout: 1000}],
      },
    ],
    unwrapEnvelope: true,
  })

  const activateEndpoint = defineHttpEndpoint<ActivateDevicePath, {verbose: boolean}, ActivateDeviceBody, ActivateDeviceResponse>({
    name: 'terminal.device.activate',
    serverName: 'communicationServiceHttp',
    method: 'POST',
    pathTemplate: '/http/devices/{deviceId}/activate',
    request: {
      path: typed<ActivateDevicePath>(),
      query: typed<{verbose: boolean}>(),
      body: typed<ActivateDeviceBody>(),
    },
    response: typed<ActivateDeviceResponse>(),
  })

  const terminalServices = defineHttpServiceModule<TerminalHttpServices>('terminal', {
    device: {
      async activate(input) {
        return runtime.call(activateEndpoint, {
          path: {
            deviceId: input.deviceId,
          },
          query: {
            verbose: true,
          },
          body: input.body,
        })
      },
    },
  })

  httpServiceRegistry.registerModule(terminalServices.moduleName, terminalServices.services)

  const terminal = httpServiceRegistry.getModule<TerminalHttpServices>('terminal')
  const result = await terminal.device.activate({
    deviceId: 'SERVICE-DEVICE-1',
    body: {
      operatorId: 'OP-1',
    },
  })

  if (!httpServiceRegistry.hasModule('terminal')) {
    throw new Error('registry 未成功注册 terminal module')
  }

  if (result.deviceId !== 'SERVICE-DEVICE-1' || result.activated !== true || result.body.operatorId !== 'OP-1') {
    throw new Error(`service-first HTTP 调用异常: ${JSON.stringify(result)}`)
  }

  return {name: 'testHttpServiceRegistry', passed: true}
}
