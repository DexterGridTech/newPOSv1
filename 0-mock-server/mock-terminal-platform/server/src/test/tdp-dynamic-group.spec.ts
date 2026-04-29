import { afterEach, describe, expect, it } from 'vitest'
import { createMockTerminalPlatformTestServer } from './createMockTerminalPlatformTestServer.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

const tdpAdminHeaders = (server: ReturnType<typeof createMockTerminalPlatformTestServer>) => ({
  'content-type': 'application/json',
  authorization: `Bearer ${server.getAdminToken()}`,
})

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
})

describe('mock-terminal-platform TDP dynamic group', () => {
  it('recomputes ordered memberships for a terminal', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
      method: 'POST',
    })
    const preparePayload = await prepareResponse.json() as {
      success: boolean
      data: {
        sandboxId: string
      }
    }
    expect(prepareResponse.status).toBe(200)
    expect(preparePayload.success).toBe(true)

    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000001',
        deviceFingerprint: 'device-kernel-base-group-001',
        deviceInfo: {
          id: 'device-kernel-base-group-001',
          model: 'Mixc Retail Android RN84',
          osVersion: 'Android 14',
        },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      success: boolean
      data: {
        terminalId: string
        binding: {
          projectId: string
          templateId: string
        }
      }
    }

    expect(activationResponse.status).toBe(201)
    expect(activationPayload.success).toBe(true)

    const createGroup = async (body: Record<string, unknown>) => {
      const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sandboxId, ...body }),
      })
      const contentType = response.headers.get('content-type') ?? ''
      const payload = contentType.includes('application/json')
        ? await response.json() as {
            success: boolean
            data?: Record<string, unknown>
            error?: {
              message?: string
            }
          }
        : {
            success: false,
            error: {
              message: await response.text(),
            },
          }
      return {
        status: response.status,
        payload,
      }
    }

    const projectGroup = await createGroup({
      groupCode: 'project-default',
      name: 'Project Default',
      description: 'project level default group',
      enabled: true,
      priority: 100,
      selectorDslJson: {
        match: { projectId: [activationPayload.data.binding.projectId] },
      },
    })
    const templateGroup = await createGroup({
      groupCode: 'template-gray',
      name: 'Template Gray',
      description: 'template level gray group',
      enabled: true,
      priority: 200,
      selectorDslJson: {
        match: { templateId: [activationPayload.data.binding.templateId] },
      },
    })

    expect(projectGroup.status).toBe(201)
    expect(templateGroup.status).toBe(201)

    const terminalId = activationPayload.data.terminalId

    const recomputeResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalId],
      }),
    })
    const recomputeContentType = recomputeResponse.headers.get('content-type') ?? ''
    const recomputePayload = recomputeContentType.includes('application/json')
      ? await recomputeResponse.json() as {
          success: boolean
          data?: unknown
          error?: {
            message?: string
          }
        }
      : {
          success: false,
          error: {
            message: await recomputeResponse.text(),
          },
        }

    expect(recomputeResponse.status).toBe(200)
    expect(recomputePayload.success).toBe(true)

    const membershipsResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/terminals/${terminalId}/memberships?sandboxId=${sandboxId}`,
    )
    const membershipsContentType = membershipsResponse.headers.get('content-type') ?? ''
    const membershipsPayload = membershipsContentType.includes('application/json')
      ? await membershipsResponse.json() as {
          success: boolean
          data?: {
            groups: Array<{
              groupCode: string
            }>
          }
          error?: {
            message?: string
          }
        }
      : {
          success: false,
          error: {
            message: await membershipsResponse.text(),
          },
        }

    expect(membershipsResponse.status).toBe(200)
    expect(membershipsPayload.success).toBe(true)
    expect(membershipsPayload.data?.groups.map(item => item.groupCode)).toEqual([
      'project-default',
      'template-gray',
    ])

    const previewResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        selectorDslJson: {
          match: { projectId: [activationPayload.data.binding.projectId] },
        },
      }),
    })
    const previewPayload = await previewResponse.json() as {
      data: {
        selectorExplain: string
        sampleTerminals: Array<{
          terminalId: string
          explain?: {
            matched: boolean
            items: Array<{ field: string; matched: boolean }>
          }
        }>
      }
    }
    expect(previewResponse.status).toBe(200)
    expect(previewPayload.data.selectorExplain).toContain('projectId')
    expect(previewPayload.data.sampleTerminals.find(item => item.terminalId === terminalId)?.explain?.matched).toBe(true)
  })

  it('recomputes memberships when runtime facts change through TDP handshake', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
      method: 'POST',
    })
    const preparePayload = await prepareResponse.json() as {
      data: { sandboxId: string }
    }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000002',
        deviceFingerprint: 'device-kernel-base-group-002',
        deviceInfo: {
          id: 'device-kernel-base-group-002',
          model: 'Mixc Retail Android RN84',
          osVersion: 'Android 14',
        },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      data: {
        terminalId: string
      }
    }
    const terminalId = activationPayload.data.terminalId

    const createGroupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'runtime-gray',
        name: 'Runtime Gray',
        description: 'match by runtime version',
        enabled: true,
        priority: 50,
        selectorDslJson: {
          match: {
            runtimeVersion: ['android-mixc-retail-rn84@1.1'],
            capabilitiesAll: ['projection-mirror'],
          },
        },
      }),
    })
    expect(createGroupResponse.status).toBe(201)

    const recomputeBeforeResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalId],
      }),
    })
    expect(recomputeBeforeResponse.status).toBe(200)

    const membershipsBeforeResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/terminals/${terminalId}/memberships?sandboxId=${sandboxId}`,
    )
    const membershipsBeforePayload = await membershipsBeforeResponse.json() as {
      data: { groups: Array<{ groupCode: string }> }
    }
    expect(membershipsBeforePayload.data.groups).toHaveLength(0)

    const upsertRuntimeFactsResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/runtime-facts/upsert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        terminalId,
        appVersion: '2.3.18',
        protocolVersion: '2026.04',
        capabilities: ['projection-mirror', 'state-sync'],
        runtimeInfo: {
          runtimeVersion: 'android-mixc-retail-rn84@1.1',
          assemblyAppId: 'assembly-android-mixc-retail-rn84',
          bundleVersion: 'bundle-2026.04.18',
        },
      }),
    })

    expect(upsertRuntimeFactsResponse.status).toBe(200)

    const membershipsAfterResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/terminals/${terminalId}/memberships?sandboxId=${sandboxId}`,
    )
    const membershipsAfterPayload = await membershipsAfterResponse.json() as {
      data: { groups: Array<{ groupCode: string }> }
    }
    expect(membershipsAfterPayload.data.groups.map(item => item.groupCode)).toEqual(['runtime-gray'])
  })

  it('materializes group policy into projection and terminal snapshot', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
      method: 'POST',
    })
    const preparePayload = await prepareResponse.json() as {
      data: { sandboxId: string }
    }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000003',
        deviceFingerprint: 'device-kernel-base-group-003',
        deviceInfo: {
          id: 'device-kernel-base-group-003',
          model: 'Mixc Retail Android RN84',
          osVersion: 'Android 14',
        },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      data: {
        terminalId: string
        binding: {
          templateId: string
        }
      }
    }
    const terminalId = activationPayload.data.terminalId

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'workflow-gray',
        name: 'Workflow Gray',
        description: 'gray workflow definition group',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            templateId: [activationPayload.data.binding.templateId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as {
      data: { groupId: string }
    }
    expect(groupResponse.status).toBe(201)

    const recomputeResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalId],
      }),
    })
    expect(recomputeResponse.status).toBe(200)

    const createPolicyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'kernel.workflow.definition',
        itemKey: 'workflow.remote.gray',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: {
          definitionId: 'workflow.remote.gray',
          workflowKey: 'workflow.remote.gray',
          enabled: true,
        },
        description: 'gray workflow definition',
      }),
    })

    expect(createPolicyResponse.status).toBe(201)

    const projectionsResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections?sandboxId=${sandboxId}`)
    const projectionsPayload = await projectionsResponse.json() as {
      data: Array<{
        topicKey: string
        scopeType: string
        scopeKey: string
        itemKey: string
      }>
    }

    expect(projectionsPayload.data.some(item =>
      item.topicKey === 'kernel.workflow.definition'
      && item.scopeType === 'GROUP'
      && item.scopeKey === groupPayload.data.groupId
      && item.itemKey === 'workflow.remote.gray',
    )).toBe(true)

    const snapshotResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}`,
    )
    const snapshotPayload = await snapshotResponse.json() as {
      data: Array<{
        topic: string
        scopeType: string
        scopeId: string
        itemKey: string
      }>
    }

    expect(snapshotPayload.data.some(item =>
      item.topic === 'kernel.workflow.definition'
      && item.scopeType === 'GROUP'
      && item.scopeId === groupPayload.data.groupId
      && item.itemKey === 'workflow.remote.gray',
    )).toBe(true)
  })

  it('keeps existing terminal snapshots valid when a later terminal newly joins the same group policy', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
      method: 'POST',
    })
    const preparePayload = await prepareResponse.json() as {
      data: { sandboxId: string }
    }
    const sandboxId = preparePayload.data.sandboxId

    const activate = async (activationCode: string, deviceId: string) => {
      const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sandboxId,
          activationCode,
          deviceFingerprint: deviceId,
          deviceInfo: {
            id: deviceId,
            model: 'Mixc Retail Android RN84',
            osVersion: 'Android 14',
          },
        }),
      })
      return response.json() as Promise<{
        data: {
          terminalId: string
          binding: {
            templateId: string
          }
        }
      }>
    }

    const terminalOne = await activate('200000000003', 'device-kernel-base-group-101')
    const terminalTwo = await activate('200000000004', 'device-kernel-base-group-102')

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'shared-gray-policy',
        name: 'Shared Gray Policy',
        description: 'shared group policy for dynamic join test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            templateId: [terminalOne.data.binding.templateId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as {
      data: { groupId: string }
    }
    expect(groupResponse.status).toBe(201)

    const recomputeFirstAfterPolicy = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalOne.data.terminalId],
      }),
    })
    expect(recomputeFirstAfterPolicy.status).toBe(200)

    const policyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'config.dynamic.join',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: {
          configVersion: 'dynamic-join-001',
        },
        description: 'dynamic join snapshot safety',
      }),
    })
    expect(policyResponse.status).toBe(201)

    const recomputeFirst = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalOne.data.terminalId],
      }),
    })
    expect(recomputeFirst.status).toBe(200)

    const snapshotFirstBefore = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalOne.data.terminalId}/snapshot?sandboxId=${sandboxId}`,
    )
    const snapshotFirstBeforePayload = await snapshotFirstBefore.json() as {
      data: Array<{
        topic: string
        itemKey: string
        scopeType: string
      }>
    }
    expect(snapshotFirstBeforePayload.data.some(item =>
      item.topic === 'config.delta'
      && item.scopeType === 'GROUP'
      && item.itemKey === 'config.dynamic.join',
    )).toBe(true)

    const recomputeSecond = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalTwo.data.terminalId],
      }),
    })
    expect(recomputeSecond.status).toBe(200)

    const snapshotFirstAfter = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalOne.data.terminalId}/snapshot?sandboxId=${sandboxId}`,
    )
    const snapshotFirstAfterPayload = await snapshotFirstAfter.json() as {
      data: Array<{
        topic: string
        itemKey: string
        scopeType: string
      }>
    }
    const snapshotSecondAfter = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalTwo.data.terminalId}/snapshot?sandboxId=${sandboxId}`,
    )
    const snapshotSecondAfterPayload = await snapshotSecondAfter.json() as {
      data: Array<{
        topic: string
        itemKey: string
        scopeType: string
      }>
    }

    expect(snapshotFirstAfterPayload.data.some(item =>
      item.topic === 'config.delta'
      && item.scopeType === 'GROUP'
      && item.itemKey === 'config.dynamic.join',
    )).toBe(true)
    expect(snapshotSecondAfterPayload.data.some(item =>
      item.topic === 'config.delta'
      && item.scopeType === 'GROUP'
      && item.itemKey === 'config.dynamic.join',
    )).toBe(true)
  })

  it('preserves projection expiresAt when an existing group projection fans out to a newly joined terminal', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
      method: 'POST',
    })
    const preparePayload = await prepareResponse.json() as {
      data: { sandboxId: string }
    }
    const sandboxId = preparePayload.data.sandboxId

    const activate = async (activationCode: string, deviceId: string) => {
      const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sandboxId,
          activationCode,
          deviceFingerprint: deviceId,
          deviceInfo: {
            id: deviceId,
            model: 'Mixc Retail Android RN84',
            osVersion: 'Android 14',
          },
        }),
      })
      return response.json() as Promise<{
        data: {
          terminalId: string
          binding: {
            templateId: string
          }
        }
      }>
    }

    const terminalOne = await activate('200000000003', 'device-kernel-base-group-ttl-101')
    const terminalTwo = await activate('200000000004', 'device-kernel-base-group-ttl-102')
    const topicKey = 'order.payment.completed.dynamic-group'

    const importedTopic = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/import/templates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topics: [{
          key: topicKey,
          name: 'Dynamic Group Payment Completed',
          scopeType: 'GROUP',
          payloadMode: 'FLEXIBLE_JSON',
          schema: {type: 'object', additionalProperties: true},
          retentionHours: 48,
          lifecycle: 'expiring',
          deliveryType: 'projection',
          defaultTtlMs: 60_000,
          minTtlMs: 1_000,
          maxTtlMs: 120_000,
        }],
      }),
    })
    expect(importedTopic.status).toBe(201)

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'shared-payment-ttl-policy',
        name: 'Shared Payment TTL Policy',
        description: 'shared expiring group policy for dynamic join test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            templateId: [terminalOne.data.binding.templateId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as {
      data: { groupId: string }
    }
    expect(groupResponse.status).toBe(201)

    const recomputeFirst = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalOne.data.terminalId],
      }),
    })
    expect(recomputeFirst.status).toBe(200)

    const policyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey,
        itemKey: 'payment-dynamic-group-ttl',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: {
          orderId: 'order-dynamic-group-ttl',
          paid: true,
        },
        description: 'dynamic join TTL metadata preservation',
      }),
    })
    expect(policyResponse.status).toBe(201)

    const snapshotFirst = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalOne.data.terminalId}/snapshot?sandboxId=${sandboxId}`,
    )
    const snapshotFirstPayload = await snapshotFirst.json() as {
      data: Array<{
        topic: string
        itemKey: string
        expiresAt?: string | null
      }>
    }
    const firstProjection = snapshotFirstPayload.data.find(item =>
      item.topic === topicKey
      && item.itemKey === 'payment-dynamic-group-ttl')
    const expiresAt = firstProjection?.expiresAt
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const recomputeSecond = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalTwo.data.terminalId],
      }),
    })
    expect(recomputeSecond.status).toBe(200)

    const snapshotSecondAfter = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalTwo.data.terminalId}/snapshot?sandboxId=${sandboxId}`,
    )
    const snapshotSecondAfterPayload = await snapshotSecondAfter.json() as {
      data: Array<{
        topic: string
        itemKey: string
        lifecycle?: string | null
        expiresAt?: string | null
      }>
    }
    expect(snapshotSecondAfterPayload.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        topic: topicKey,
        itemKey: 'payment-dynamic-group-ttl',
        lifecycle: 'expiring',
        expiresAt,
      }),
    ]))
  })

  it('recompute-all recalculates memberships for every terminal in a sandbox', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {
      method: 'POST',
    })
    const preparePayload = await prepareResponse.json() as {
      data: { sandboxId: string }
    }
    const sandboxId = preparePayload.data.sandboxId

    const activate = async (activationCode: string, deviceId: string) => {
      const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sandboxId,
          activationCode,
          deviceFingerprint: deviceId,
          deviceInfo: {
            id: deviceId,
            model: 'Mixc Retail Android RN84',
            osVersion: 'Android 14',
          },
        }),
      })
      return response.json() as Promise<{
        data: {
          terminalId: string
          binding: {
            projectId: string
          }
        }
      }>
    }

    const terminalOne = await activate('200000000001', 'device-kernel-base-group-201')
    const terminalTwo = await activate('200000000002', 'device-kernel-base-group-202')

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'project-all-terminals',
        name: 'Project All Terminals',
        description: 'recompute all test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            projectId: [terminalOne.data.binding.projectId],
          },
        },
      }),
    })
    expect(groupResponse.status).toBe(201)

    const recomputeAllResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-all`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sandboxId }),
    })
    const recomputeAllPayload = await recomputeAllResponse.json() as {
      success: boolean
      data: {
        total: number
        items: Array<{
          terminalId: string
          groups: Array<{ groupCode: string }>
        }>
      }
    }

    expect(recomputeAllResponse.status).toBe(200)
    expect(recomputeAllPayload.success).toBe(true)
    expect(recomputeAllPayload.data.total).toBe(2)
    expect(recomputeAllPayload.data.items.find(item => item.terminalId === terminalOne.data.terminalId)?.groups.map(item => item.groupCode)).toEqual(['project-all-terminals'])
    expect(recomputeAllPayload.data.items.find(item => item.terminalId === terminalTwo.data.terminalId)?.groups.map(item => item.groupCode)).toEqual(['project-all-terminals'])
  })

  it('rejects deleting a group while an enabled policy is still bound', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000001',
        deviceFingerprint: 'device-kernel-base-group-301',
        deviceInfo: { id: 'device-kernel-base-group-301', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as { data: { terminalId: string; binding: { projectId: string } } }

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'delete-protected-group',
        name: 'Delete Protected Group',
        description: 'delete protection',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            projectId: [activationPayload.data.binding.projectId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }
    expect(groupResponse.status).toBe(201)

    await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [activationPayload.data.terminalId],
      }),
    })

    const policyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'config.delete.protected',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: { version: 'v1' },
        description: 'enabled policy',
      }),
    })
    expect(policyResponse.status).toBe(201)

    const deleteGroupResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/${groupPayload.data.groupId}?sandboxId=${encodeURIComponent(sandboxId)}`,
      { method: 'DELETE' },
    )
    const deleteGroupPayload = await deleteGroupResponse.json() as { success: boolean; error?: { message?: string } }

    expect(deleteGroupResponse.status).toBe(400)
    expect(deleteGroupPayload.success).toBe(false)
    expect(deleteGroupPayload.error?.message).toContain('enabled policy')
  })

  it('explains policy impact reason for group overrides', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000001',
        deviceFingerprint: 'device-impact-reason-001',
        deviceInfo: { id: 'device-impact-reason-001', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as { data: { terminalId: string; binding: { projectId: string } } }

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'impact-reason-group',
        name: 'Impact Reason Group',
        description: 'policy impact reason test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            projectId: [activationPayload.data.binding.projectId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }
    expect(groupResponse.status).toBe(201)

    await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [activationPayload.data.terminalId],
      }),
    })

    const previewResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies/preview-impact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'config.reason.test',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: { version: 'v1' },
      }),
    })
    const previewPayload = await previewResponse.json() as {
      data: {
        changedTerminalCount: number
        warnings: string[]
        impacts: Array<{ terminalId: string; reason: string }>
      }
    }
    expect(previewResponse.status).toBe(200)
    expect(previewPayload.data.changedTerminalCount).toBe(1)
    expect(previewPayload.data.warnings).toContain('GROUP_SCOPE_OVERRIDES_STORE_AND_LOWER_DEFAULTS')
    expect(previewPayload.data.impacts[0]?.reason).toBe('new-winner')
  })

  it('disables and deletes group policy materialization from terminal snapshot', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000002',
        deviceFingerprint: 'device-kernel-base-group-302',
        deviceInfo: { id: 'device-kernel-base-group-302', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as { data: { terminalId: string; binding: { templateId: string } } }
    const terminalId = activationPayload.data.terminalId

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'policy-disable-group',
        name: 'Policy Disable Group',
        description: 'policy disable test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            templateId: [activationPayload.data.binding.templateId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }
    expect(groupResponse.status).toBe(201)

    await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalId],
      }),
    })

    const policyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'config.disable.policy',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: { version: 'v1' },
        description: 'toggle and delete test',
      }),
    })
    const policyPayload = await policyResponse.json() as { data: { policyId: string } }
    expect(policyResponse.status).toBe(201)

    const snapshotBefore = await fetch(`${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}`)
    const snapshotBeforePayload = await snapshotBefore.json() as {
      data: Array<{ topic: string; itemKey: string; scopeType: string }>
    }
    expect(snapshotBeforePayload.data.some(item =>
      item.topic === 'config.delta'
      && item.scopeType === 'GROUP'
      && item.itemKey === 'config.disable.policy',
    )).toBe(true)

    const disableResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies/${policyPayload.data.policyId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        enabled: false,
      }),
    })
    expect(disableResponse.status).toBe(200)

    const snapshotAfterDisable = await fetch(`${server.getHttpBaseUrl()}/api/v1/tdp/terminals/${terminalId}/snapshot?sandboxId=${sandboxId}`)
    const snapshotAfterDisablePayload = await snapshotAfterDisable.json() as {
      data: Array<{ topic: string; itemKey: string; scopeType: string }>
    }
    expect(snapshotAfterDisablePayload.data.some(item =>
      item.topic === 'config.delta'
      && item.scopeType === 'GROUP'
      && item.itemKey === 'config.disable.policy',
    )).toBe(false)

    const deletePolicyResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies/${policyPayload.data.policyId}?sandboxId=${encodeURIComponent(sandboxId)}`,
      { method: 'DELETE' },
    )
    expect(deletePolicyResponse.status).toBe(200)
  })

  it('builds terminal decision trace with GROUP winner overriding STORE', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000003',
        deviceFingerprint: 'device-kernel-base-group-401',
        deviceInfo: { id: 'device-kernel-base-group-401', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      data: {
        terminalId: string
        binding: {
          storeId: string
          templateId: string
        }
      }
    }
    const terminalId = activationPayload.data.terminalId

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'trace-gray-group',
        name: 'Trace Gray Group',
        description: 'decision trace test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            templateId: [activationPayload.data.binding.templateId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }
    expect(groupResponse.status).toBe(201)

    await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalId],
      }),
    })

    const storeProjectionResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/upsert`, {
      method: 'POST',
      headers: tdpAdminHeaders(server),
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        scopeType: 'STORE',
        scopeKey: activationPayload.data.binding.storeId,
        itemKey: 'main',
        payload: { version: 'store-default' },
      }),
    })
    expect(storeProjectionResponse.status).toBe(200)

    const policyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'main',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: { version: 'group-hotfix' },
        description: 'trace policy',
      }),
    })
    expect(policyResponse.status).toBe(201)

    const traceResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/terminals/${terminalId}/decision-trace?sandboxId=${encodeURIComponent(sandboxId)}`,
    )
    const tracePayload = await traceResponse.json() as {
      success: boolean
      data: {
        resolvedResults: Record<string, Record<string, { version: string }>>
        perTopicCandidates: Array<{
          topicKey: string
          itemKey: string
          winner: {
            scopeType: string
            reason: string
          }
        }>
      }
    }

    expect(traceResponse.status).toBe(200)
    expect(tracePayload.data.resolvedResults['config.delta']?.main?.version).toBe('group-hotfix')
    expect(tracePayload.data.perTopicCandidates.find(item => item.topicKey === 'config.delta' && item.itemKey === 'main')?.winner.scopeType).toBe('GROUP')
    expect(tracePayload.data.perTopicCandidates.find(item => item.topicKey === 'config.delta' && item.itemKey === 'main')?.winner.reason).toContain('overrides')
  })

  it('previews policy impact before creating a GROUP policy', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000004',
        deviceFingerprint: 'device-kernel-base-group-402',
        deviceInfo: { id: 'device-kernel-base-group-402', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      data: {
        terminalId: string
        binding: {
          storeId: string
          templateId: string
        }
      }
    }
    const terminalId = activationPayload.data.terminalId

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'preview-gray-group',
        name: 'Preview Gray Group',
        description: 'preview impact test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: {
            templateId: [activationPayload.data.binding.templateId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }
    expect(groupResponse.status).toBe(201)

    await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [terminalId],
      }),
    })

    await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/projections/upsert`, {
      method: 'POST',
      headers: tdpAdminHeaders(server),
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        scopeType: 'STORE',
        scopeKey: activationPayload.data.binding.storeId,
        itemKey: 'main',
        payload: { version: 'store-default' },
      }),
    })

    const previewResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies/preview-impact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'main',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: { version: 'preview-hotfix' },
      }),
    })
    const previewPayload = await previewResponse.json() as {
      success: boolean
      data: {
        targetTerminalCount: number
        changedTerminalCount: number
        impacts: Array<{
          terminalId: string
          changed: boolean
          currentWinner: { scopeType: string } | null
          nextWinner: { scopeType: string; payload: { version: string } } | null
        }>
      }
    }

    expect(previewResponse.status).toBe(200)
    expect(previewPayload.data.targetTerminalCount).toBe(1)
    expect(previewPayload.data.changedTerminalCount).toBe(1)
    expect(previewPayload.data.impacts[0]?.terminalId).toBe(terminalId)
    expect(previewPayload.data.impacts[0]?.changed).toBe(true)
    expect(previewPayload.data.impacts[0]?.currentWinner?.scopeType).toBe('STORE')
    expect(previewPayload.data.impacts[0]?.nextWinner?.scopeType).toBe('GROUP')
    expect(previewPayload.data.impacts[0]?.nextWinner?.payload.version).toBe('preview-hotfix')
  })

  it('previews selector group matches and exposes grouped stats', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000005',
        deviceFingerprint: 'device-kernel-base-group-501',
        deviceInfo: { id: 'device-kernel-base-group-501', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      data: { terminalId: string; binding: { templateId: string } }
    }

    const previewResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        selectorDslJson: {
          match: {
            templateId: [activationPayload.data.binding.templateId],
          },
        },
      }),
    })
    const previewPayload = await previewResponse.json() as {
      data: {
        matchedTerminalCount: number
        sampleTerminals: Array<{ terminalId: string }>
        distributions: { templateId?: Array<{ key: string; count: number }> }
      }
    }

    expect(previewResponse.status).toBe(200)
    expect(previewPayload.data.matchedTerminalCount).toBe(1)
    expect(previewPayload.data.sampleTerminals[0]?.terminalId).toBe(activationPayload.data.terminalId)

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'stats-gray-group',
        name: 'Stats Gray Group',
        description: 'stats test',
        enabled: true,
        priority: 90,
        selectorDslJson: {
          match: {
            templateId: [activationPayload.data.binding.templateId],
          },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }
    expect(groupResponse.status).toBe(201)

    const recomputeResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'TERMINAL',
        scopeKeys: [activationPayload.data.terminalId],
      }),
    })
    expect(recomputeResponse.status).toBe(200)

    const statsResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/${groupPayload.data.groupId}/stats?sandboxId=${encodeURIComponent(sandboxId)}`,
    )
    const statsPayload = await statsResponse.json() as {
      data: {
        memberCount: number
        members: Array<{ terminalId: string }>
      }
    }

    expect(statsResponse.status).toBe(200)
    expect(statsPayload.data.memberCount).toBe(1)
    expect(statsPayload.data.members[0]?.terminalId).toBe(activationPayload.data.terminalId)
  })

  it('validates projection policy bucket conflicts before save', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'validate-gray-group',
        name: 'Validate Gray Group',
        description: 'validate test',
        enabled: true,
        priority: 100,
        selectorDslJson: { match: { templateId: ['template-kernel-base-android-pos-standard'] } },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }

    const createPolicyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'bucket-check',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: { version: 'v1' },
        description: 'conflict anchor',
      }),
    })
    expect(createPolicyResponse.status).toBe(201)

    const validateResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'bucket-check',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
      }),
    })
    const validatePayload = await validateResponse.json() as {
      data: { valid: boolean; conflictCount: number; warnings: string[] }
    }

    expect(validateResponse.status).toBe(200)
    expect(validatePayload.data.valid).toBe(false)
    expect(validatePayload.data.conflictCount).toBe(1)
    expect(validatePayload.data.warnings).toContain('ENABLED_BUCKET_CONFLICT')
  })

  it('updates selector group and recomputes memberships', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000006',
        deviceFingerprint: 'device-kernel-base-group-601',
        deviceInfo: { id: 'device-kernel-base-group-601', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      data: { terminalId: string; binding: { templateId: string; projectId: string } }
    }

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'update-gray-group',
        name: 'Update Gray Group',
        description: 'update test',
        enabled: true,
        priority: 100,
        selectorDslJson: { match: { templateId: ['not-exist-template'] } },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }

    const updateResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/${groupPayload.data.groupId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        selectorDslJson: { match: { templateId: [activationPayload.data.binding.templateId] } },
      }),
    })
    expect(updateResponse.status).toBe(200)

    const membershipsResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/terminals/${activationPayload.data.terminalId}/memberships?sandboxId=${encodeURIComponent(sandboxId)}`,
    )
    const membershipsPayload = await membershipsResponse.json() as {
      data: { groups: Array<{ groupCode: string }> }
    }

    expect(membershipsResponse.status).toBe(200)
    expect(membershipsPayload.data.groups.map(item => item.groupCode)).toContain('update-gray-group')
  })

  it('returns policy center overview summary', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const overviewResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/policy-center/overview?sandboxId=${encodeURIComponent(sandboxId)}`,
    )
    const overviewPayload = await overviewResponse.json() as {
      data: {
        stats: {
          groups: { total: number }
          policies: { total: number }
          terminals: { total: number }
        }
        recentGroups: unknown[]
        recentPolicies: unknown[]
        risks: {
          groupsWithoutMembers: unknown[]
        }
      }
    }

    expect(overviewResponse.status).toBe(200)
    expect(overviewPayload.data.stats.groups.total).toBeGreaterThanOrEqual(0)
    expect(overviewPayload.data.stats.policies.total).toBeGreaterThanOrEqual(0)
    expect(overviewPayload.data.stats.terminals.total).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(overviewPayload.data.recentGroups)).toBe(true)
    expect(Array.isArray(overviewPayload.data.recentPolicies)).toBe(true)
    expect(Array.isArray(overviewPayload.data.risks.groupsWithoutMembers)).toBe(true)
  })

  it('supports recompute by project scope and group memberships query', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000007',
        deviceFingerprint: 'device-kernel-base-group-701',
        deviceInfo: { id: 'device-kernel-base-group-701', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      data: { terminalId: string; binding: { projectId: string; templateId: string } }
    }

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'project-scope-group',
        name: 'Project Scope Group',
        description: 'scope recompute test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: { templateId: [activationPayload.data.binding.templateId] },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }

    const recomputeResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/recompute-by-scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        scopeType: 'PROJECT',
        scopeKeys: [activationPayload.data.binding.projectId],
      }),
    })
    const recomputePayload = await recomputeResponse.json() as { data: { total: number } }
    expect(recomputeResponse.status).toBe(200)
    expect(recomputePayload.data.total).toBe(1)

    const membershipsResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/${groupPayload.data.groupId}/memberships?sandboxId=${encodeURIComponent(sandboxId)}`,
    )
    const membershipsPayload = await membershipsResponse.json() as {
      data: { memberCount: number; members: Array<{ terminalId: string }> }
    }
    expect(membershipsResponse.status).toBe(200)
    expect(membershipsPayload.data.memberCount).toBe(1)
    expect(membershipsPayload.data.members[0]?.terminalId).toBe(activationPayload.data.terminalId)
  })

  it('returns policy detail by id and group recompute endpoint', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepareResponse = await fetch(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, { method: 'POST' })
    const preparePayload = await prepareResponse.json() as { data: { sandboxId: string } }
    const sandboxId = preparePayload.data.sandboxId

    const activationResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        activationCode: '200000000008',
        deviceFingerprint: 'device-kernel-base-group-801',
        deviceInfo: { id: 'device-kernel-base-group-801', model: 'Mixc Retail Android RN84' },
      }),
    })
    const activationPayload = await activationResponse.json() as {
      data: { binding: { templateId: string } }
    }

    const groupResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        groupCode: 'policy-detail-group',
        name: 'Policy Detail Group',
        description: 'policy detail test',
        enabled: true,
        priority: 100,
        selectorDslJson: {
          match: { templateId: [activationPayload.data.binding.templateId] },
        },
      }),
    })
    const groupPayload = await groupResponse.json() as { data: { groupId: string } }

    const groupRecomputeResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/groups/${groupPayload.data.groupId}/recompute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sandboxId }),
    })
    expect(groupRecomputeResponse.status).toBe(200)

    const createPolicyResponse = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        topicKey: 'config.delta',
        itemKey: 'policy-detail',
        scopeType: 'GROUP',
        scopeKey: groupPayload.data.groupId,
        enabled: true,
        payloadJson: { version: 'detail-v1' },
        description: 'policy detail view',
      }),
    })
    const createPolicyPayload = await createPolicyResponse.json() as { data: { policyId: string } }
    expect(createPolicyResponse.status).toBe(201)

    const detailResponse = await fetch(
      `${server.getHttpBaseUrl()}/api/v1/admin/tdp/policies/${createPolicyPayload.data.policyId}?sandboxId=${encodeURIComponent(sandboxId)}`,
    )
    const detailPayload = await detailResponse.json() as {
      data: { policyId: string; itemKey: string; enabled: boolean; payloadJson: { version: string } }
    }

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.data.policyId).toBe(createPolicyPayload.data.policyId)
    expect(detailPayload.data.itemKey).toBe('policy-detail')
    expect(detailPayload.data.enabled).toBe(true)
    expect(detailPayload.data.payloadJson.version).toBe('detail-v1')
  })
})
