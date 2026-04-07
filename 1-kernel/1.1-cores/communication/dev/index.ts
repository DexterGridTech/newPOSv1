import {testHttpBasic} from './test-http-basic'
import {testHttpRuntime} from './test-http-runtime'
import {testHttpAdvanced} from './test-http-advanced'
import {testHttpControl} from './test-http-control'
import {testHttpServiceRegistry} from './test-http-service-registry'
import {testWsBasic} from './test-ws-basic'
import {testWsRuntime} from './test-ws-runtime'
import {testWsAdvanced} from './test-ws-advanced'
import {testWsReconnectFailover} from './test-ws-reconnect-failover'
import {testWsSessionOrchestrator} from './test-ws-session-orchestrator'
import {testWsSessionRefresh} from './test-ws-session-refresh'
import {testWsObservability} from './test-ws-observability'
import {testWsRefreshPolicy} from './test-ws-refresh-policy'

async function run() {
  const results = []
  const tests = [
    testHttpBasic,
    testHttpRuntime,
    testHttpAdvanced,
    testHttpControl,
    testHttpServiceRegistry,
    testWsBasic,
    testWsRuntime,
    testWsAdvanced,
    testWsReconnectFailover,
    testWsSessionOrchestrator,
    testWsSessionRefresh,
    testWsObservability,
    testWsRefreshPolicy,
  ]

  for (const test of tests) {
    try {
      const result = await test()
      results.push(result)
      console.log(`[PASS] ${result.name}`)
    } catch (error) {
      console.error(`[FAIL] ${test.name}`, error)
      process.exit(1)
    }
  }

  console.log('All communication tests passed:', results.length)
}

void run()
