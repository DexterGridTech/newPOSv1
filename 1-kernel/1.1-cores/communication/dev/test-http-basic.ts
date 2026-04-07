import {buildHttpUrl, defineHttpEndpoint, typed} from '../src'

export async function testHttpBasic() {
  const endpoint = defineHttpEndpoint<{deviceId: string}, {verbose?: boolean}, {activeCode: string}, {activated: boolean}>({
    name: 'test.http.basic',
    serverName: 'communicationTest',
    method: 'POST',
    pathTemplate: '/http/devices/{deviceId}/activate',
    request: {
      path: typed<{deviceId: string}>(),
      query: typed<{verbose?: boolean}>(),
      body: typed<{activeCode: string}>(),
    },
    response: typed<{activated: boolean}>(),
  })

  const url = buildHttpUrl('http://localhost:6190', endpoint.pathTemplate, {deviceId: 'D-1'}, {verbose: true})
  if (url !== 'http://localhost:6190/http/devices/D-1/activate?verbose=true') {
    throw new Error(`URL 构造异常: ${url}`)
  }

  return {name: 'testHttpBasic', passed: true}
}
