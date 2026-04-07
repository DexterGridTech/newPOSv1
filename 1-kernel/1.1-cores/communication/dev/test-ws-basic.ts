import {buildSocketUrl, defineSocketProfile, typed} from '../src'

export async function testWsBasic() {
  const profile = defineSocketProfile<{deviceId: string; token: string}, Record<string, string>, {type: string}, {type: string}>({
    name: 'test.ws.basic',
    serverName: 'communicationWs',
    pathTemplate: '/ws/echo',
    handshake: {
      query: typed<{deviceId: string; token: string}>(),
      headers: typed<Record<string, string>>(),
    },
    messages: {
      incoming: typed<{type: string}>(),
      outgoing: typed<{type: string}>(),
    },
  })

  const url = buildSocketUrl('http://localhost:6190', profile.pathTemplate, {deviceId: 'W-1', token: 'TK-1'})
  if (url !== 'ws://localhost:6190/ws/echo?deviceId=W-1&token=TK-1') {
    throw new Error(`WS URL 构造异常: ${url}`)
  }

  return {name: 'testWsBasic', passed: true}
}
