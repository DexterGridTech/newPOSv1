import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {selectTcpSandboxId, selectTcpTerminalId} from '@next/kernel-base-tcp-control-runtime-v2'
import {moduleName} from '../../moduleName'
import type {TdpSyncHttpServiceRefV2} from '../../types'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpSyncV2StateActions} from '../slices'
import {selectTdpSessionState} from '../../selectors'

const defineActor = createModuleActorFactory(moduleName)

const DEFAULT_CHANGES_PAGE_LIMIT = 100

export const createTdpChangesFetchActorDefinitionV2 = (
    httpServiceRef: TdpSyncHttpServiceRefV2,
): ActorDefinition => defineActor(
    'TdpChangesFetchActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.changesApplyCompleted, async context => {
            const payload = context.command.payload
            if (!payload.hasMore) {
                return {
                    hasMore: false,
                }
            }
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.fetchMoreChanges, {
                cursor: payload.nextCursor,
                highWatermark: payload.highWatermark,
            }))
            return {
                hasMore: true,
                nextCursor: payload.nextCursor,
            }
        }),
        onCommand(tdpSyncV2CommandDefinitions.fetchMoreChanges, async context => {
            const httpService = httpServiceRef.current
            if (!httpService) {
                throw new Error('TDP_HTTP_SERVICE_NOT_INSTALLED')
            }
            const state = context.getState()
            const sandboxId = selectTcpSandboxId(state)
            const terminalId = selectTcpTerminalId(state)
            if (!sandboxId || !terminalId) {
                throw new Error('TDP_HTTP_FETCH_CREDENTIAL_MISSING')
            }

            const sessionSubscription = selectTdpSessionState(state)?.subscription
            context.dispatchAction(tdpSyncV2StateActions.setChangesStatus('catching-up'))
            const result = await httpService.getChanges(
                sandboxId,
                terminalId,
                context.command.payload.cursor,
                context.command.payload.limit ?? DEFAULT_CHANGES_PAGE_LIMIT,
                sessionSubscription?.mode === 'explicit'
                    ? {
                        subscribedTopics: sessionSubscription.acceptedTopics,
                        subscriptionHash: sessionSubscription.hash,
                    }
                    : undefined,
            )
            await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, {
                changes: result.changes,
                nextCursor: result.nextCursor,
                highWatermark: result.highWatermark,
                hasMore: result.hasMore,
            }))
            return {
                count: result.changes.length,
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
            }
        }),
    ],
)
