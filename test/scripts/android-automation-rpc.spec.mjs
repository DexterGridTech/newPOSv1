import {describe, expect, it} from 'vitest'
import {
  buildActivateDeviceSequence,
  buildVirtualKeyboardSequence,
  buildWaitForActivatedSequence,
  isLiveAutomationNode,
  normalizeVirtualKey,
  parseAndroidDate,
  unwrapJsonRpcResponse,
} from '../../scripts/android-automation-rpc.mjs'

describe('android-automation-rpc helpers', () => {
  it('normalizes virtual keyboard keys for adb-friendly input', () => {
    expect(normalizeVirtualKey('a')).toBe('A')
    expect(normalizeVirtualKey('-')).toBe('-')
    expect(normalizeVirtualKey('_')).toBe('_')
  })

  it('parses android shell date output with timezone offset', () => {
    const parsed = parseAndroidDate('2026-04-18T03:02:23+0800')
    expect(parsed).toBeInstanceOf(Date)
    expect(parsed?.toISOString()).toBe('2026-04-17T19:02:23.000Z')
  })

  it('returns null for invalid android shell date output', () => {
    expect(parseAndroidDate('not-a-date')).toBeNull()
  })

  it('treats stale automation nodes as not live', () => {
    expect(isLiveAutomationNode({nodeId: 'x', stale: false})).toBe(true)
    expect(isLiveAutomationNode({nodeId: 'x', stale: true})).toBe(false)
    expect(isLiveAutomationNode(null)).toBe(false)
  })

  it('builds virtual keyboard actions for a field', () => {
    const steps = buildVirtualKeyboardSequence(
      'ui-base-terminal-activate-device:sandbox',
      'ab-1_',
      {target: 'primary', timeoutMs: 5000},
    )

    expect(steps).toEqual([
      {
        method: 'ui.performAction',
        params: {
          target: 'primary',
          nodeId: 'ui-base-terminal-activate-device:sandbox',
          action: 'press',
        },
      },
      {
        method: 'wait.forNode',
        params: {
          target: 'primary',
          testID: 'ui-base-virtual-keyboard',
          timeoutMs: 5000,
        },
      },
      {
        method: 'ui.performAction',
        params: {
          target: 'primary',
          nodeId: 'ui-base-virtual-keyboard:key:clear',
          action: 'press',
        },
      },
      {
        method: 'ui.performAction',
        params: {
          target: 'primary',
          nodeId: 'ui-base-virtual-keyboard:key:A',
          action: 'press',
        },
      },
      {
        method: 'ui.performAction',
        params: {
          target: 'primary',
          nodeId: 'ui-base-virtual-keyboard:key:B',
          action: 'press',
        },
      },
      {
        method: 'ui.performAction',
        params: {
          target: 'primary',
          nodeId: 'ui-base-virtual-keyboard:key:-',
          action: 'press',
        },
      },
      {
        method: 'ui.performAction',
        params: {
          target: 'primary',
          nodeId: 'ui-base-virtual-keyboard:key:1',
          action: 'press',
        },
      },
      {
        method: 'ui.performAction',
        params: {
          target: 'primary',
          nodeId: 'ui-base-virtual-keyboard:key:_',
          action: 'press',
        },
      },
      {
        method: 'ui.performAction',
        params: {
          target: 'primary',
          nodeId: 'ui-base-virtual-keyboard:key:enter',
          action: 'press',
        },
      },
      {
        method: 'wait.forIdle',
        params: {
          target: 'primary',
          timeoutMs: 5000,
        },
      },
    ])
  })

  it('builds full activate-device flow through virtual keyboards', () => {
    const steps = buildActivateDeviceSequence('sandbox-test-001', 'ABC123', {
      target: 'primary',
      timeoutMs: 8000,
    })

    expect(steps[0]).toMatchObject({
      method: 'ui.performAction',
      params: {
        target: 'primary',
        nodeId: 'ui-base-terminal-activate-device:sandbox',
        action: 'press',
      },
    })
    expect(steps.some(step => step.params?.nodeId === 'ui-base-terminal-activate-device:input')).toBe(true)
    expect(steps.some(step => step.params?.nodeId === 'ui-base-terminal-activate-device:submit')).toBe(true)
    expect(steps.filter(step => step.params?.nodeId === 'ui-base-virtual-keyboard:key:clear')).toHaveLength(2)
    expect(steps.at(-1)).toEqual({
      method: 'wait.forIdle',
      params: {
        target: 'primary',
        timeoutMs: 8000,
      },
    })
  })

  it('builds post-activation verification against stable tcp state paths', () => {
    const steps = buildWaitForActivatedSequence('sandbox-test-001', {
      target: 'primary',
      timeoutMs: 8000,
    })

    expect(steps).toEqual([
      {
        method: 'wait.forState',
        params: {
          target: 'primary',
          path: ['kernel.base.tcp-control-runtime-v2.identity', 'activationStatus'],
          equals: 'ACTIVATED',
          timeoutMs: 8000,
        },
      },
      {
        method: 'wait.forState',
        params: {
          target: 'primary',
          path: ['kernel.base.tcp-control-runtime-v2.sandbox', 'sandboxId'],
          equals: 'sandbox-test-001',
          timeoutMs: 8000,
        },
      },
      {
        method: 'runtime.selectState',
        params: {
          target: 'primary',
          path: ['kernel.base.tcp-control-runtime-v2.identity', 'terminalId'],
        },
      },
      {
        method: 'runtime.selectState',
        params: {
          target: 'primary',
          path: ['kernel.base.tcp-control-runtime-v2.sandbox', 'sandboxId'],
        },
      },
    ])
  })

  it('unwraps successful json-rpc responses', () => {
    expect(unwrapJsonRpcResponse({
      jsonrpc: '2.0',
      result: {ok: true},
      id: '1',
    })).toEqual({ok: true})
  })

  it('throws on json-rpc error responses', () => {
    expect(() => unwrapJsonRpcResponse({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'automation js dispatcher timeout',
      },
      id: '1',
    }, 'wait.forNode')).toThrow('automation js dispatcher timeout')
  })
})
