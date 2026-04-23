import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {
    selectTdpProjectionByTopicAndBucket,
    selectTdpResolvedProjection,
    selectTdpSessionState,
    selectTerminalGroupMembership,
    tdpSyncV2CommandDefinitions,
} from '../../src'
import {
    activateLiveTerminal,
    createLivePlatform,
    createLiveRuntime,
    readLiveTerminalScope,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime-v2 live group policy', () => {
    it('receives policy created before terminal joins a dynamic group', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })
        await runtime.start()
        await activateLiveTerminal(runtime, platform.prepare.sandboxId, '200000000004', 'device-live-tdp-v2-group-policy-001')

        const {terminalId, binding} = readLiveTerminalScope(runtime)
        const group = await platform.admin.createSelectorGroup({
            groupCode: 'live-template-gray',
            name: 'Live Template Gray',
            description: 'live group policy test',
            enabled: true,
            priority: 100,
            selectorDslJson: {
                match: {
                    templateId: [binding.templateId],
                },
            },
        })

        await platform.admin.createProjectionPolicy({
            topicKey: 'config.delta',
            itemKey: 'config.live.group-policy',
            scopeType: 'GROUP',
            scopeKey: group.groupId,
            enabled: true,
            payloadJson: {
                configVersion: 'live-group-policy-001',
                source: 'dynamic-group',
            },
            description: 'live group policy before terminal joins',
        })

        await platform.admin.recomputeGroupsByScope({
            scopeType: 'TERMINAL',
            scopeKeys: [terminalId],
        })

        await runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )
        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY', 5_000)

        await waitFor(() => {
            return selectTdpResolvedProjection(runtime.getState(), {
                topic: 'config.delta',
                itemKey: 'config.live.group-policy',
            })?.payload.configVersion === 'live-group-policy-001'
        }, 5_000)

        expect(selectTerminalGroupMembership(runtime.getState())?.groups.map(item => item.groupId)).toContain(group.groupId)
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'GROUP',
            scopeId: group.groupId,
            itemKey: 'config.live.group-policy',
        })?.payload).toMatchObject({
            configVersion: 'live-group-policy-001',
            source: 'dynamic-group',
        })
        expect(selectTdpResolvedProjection(runtime.getState(), {
            topic: 'config.delta',
            itemKey: 'config.live.group-policy',
        })?.payload).toMatchObject({
            configVersion: 'live-group-policy-001',
            source: 'dynamic-group',
        })

        const memberships = await platform.admin.terminalGroupMemberships(terminalId)
        expect(memberships.groups.map((item: { groupCode: string }) => item.groupCode)).toContain('live-template-gray')
    }, 20_000)
})
