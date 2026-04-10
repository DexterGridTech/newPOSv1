import http from 'http'
import {URL} from 'url'
import WebSocket, {WebSocketServer} from 'ws'
import {
    type CommandDispatchEnvelope,
    type CommandEventEnvelope,
    type NodeHello,
    type ProjectionMirrorEnvelope,
    type RequestLifecycleSnapshotEnvelope,
    type StateSyncCommitAckEnvelope,
    type StateSyncDiffEnvelope,
    type StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import type {HostFaultRule, HostResumeBeginEnvelope} from '@impos2/kernel-base-host-runtime'
import {createDualTopologyHost} from './createDualTopologyHost'
import type {DualTopologyHost} from '../types/hostShell'
import type {
    CreatePairingTicketRequest,
    CreatePairingTicketResponse,
    DualTopologyHostServerConfig,
    DualTopologyHostAddressInfo,
    DualTopologyIncomingMessage,
    DualTopologyOutgoingMessage,
    DualTopologyStats,
    FaultRuleReplaceRequest,
    FaultRuleReplaceResponse,
    HostConnectionContext,
    RelayEnvelopeMessage,
    RoutedOutgoingMessage,
} from '../types/server'
import {moduleName} from '../moduleName'
import {runtimeContracts} from './runtimeDeps'

const DEFAULT_SERVER_CONFIG: DualTopologyHostServerConfig = {
    port: 8888,
    basePath: '/mockMasterServer',
    heartbeatIntervalMs: 30_000,
    heartbeatTimeoutMs: 60_000,
}

const isRelayEnvelopeMessage = (message: DualTopologyIncomingMessage): message is RelayEnvelopeMessage => {
    return message.type === 'command-dispatch'
        || message.type === 'command-event'
        || message.type === 'projection-mirror'
        || message.type === 'request-lifecycle-snapshot'
        || message.type === 'state-sync-summary'
        || message.type === 'state-sync-diff'
        || message.type === 'state-sync-commit-ack'
}

const createResumeBeginEnvelope = (input: {
    sessionId: string
    sourceNodeId: string
    targetNodeId: string
    timestamp: number
}): HostResumeBeginEnvelope => {
    return {
        envelopeId: runtimeContracts.createEnvelopeId(),
        sessionId: input.sessionId as any,
        sourceNodeId: input.sourceNodeId as any,
        targetNodeId: input.targetNodeId as any,
        timestamp: input.timestamp as any,
    }
}

const isResumeBeginEnvelope = (envelope: RelayEnvelopeMessage['envelope'] | HostResumeBeginEnvelope): envelope is HostResumeBeginEnvelope => {
    return 'timestamp' in envelope
        && !('commandName' in envelope)
        && !('projection' in envelope)
        && !('snapshot' in envelope)
        && !('summaryBySlice' in envelope)
        && !('diffBySlice' in envelope)
        && !('committedAt' in envelope)
}

const readJsonBody = async <TValue>(request: http.IncomingMessage): Promise<TValue> => {
    const chunks: Buffer[] = []
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw.length === 0 ? {} as TValue : JSON.parse(raw) as TValue
}

const writeJson = (response: http.ServerResponse, statusCode: number, payload: unknown) => {
    response.statusCode = statusCode
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(payload))
}

export interface DualTopologyHostServer {
    readonly host: DualTopologyHost
    readonly config: DualTopologyHostServerConfig
    start(): Promise<void>
    close(): Promise<void>
    getAddressInfo(): DualTopologyHostAddressInfo
    getStats(): DualTopologyStats
    replaceFaultRules(rules: HostFaultRule[]): FaultRuleReplaceResponse
    handleIncomingMessage(connectionId: string, message: DualTopologyIncomingMessage): RoutedOutgoingMessage[]
}

export interface CreateDualTopologyHostServerInput {
    host?: DualTopologyHost
    config?: Partial<DualTopologyHostServerConfig>
}

export const createDualTopologyHostServer = (
    input: CreateDualTopologyHostServerInput = {},
): DualTopologyHostServer => {
    const config: DualTopologyHostServerConfig = {
        ...DEFAULT_SERVER_CONFIG,
        ...input.config,
    }
    const host = input.host ?? createDualTopologyHost({
        heartbeatTimeoutMs: config.heartbeatTimeoutMs,
    })
    const logger = host.logger.scope({
        subsystem: 'dual-topology-host-server',
        component: 'DualTopologyHostServer',
    })

    const server = http.createServer()
    const wss = new WebSocketServer({noServer: true})
    const socketContexts = new Map<WebSocket, HostConnectionContext>()
    const socketsByConnectionId = new Map<string, WebSocket>()
    const connectionContexts = new Map<string, HostConnectionContext>()
    let heartbeatTimer: NodeJS.Timeout | undefined

    const getAddressInfo = (): DualTopologyHostAddressInfo => {
        const address = server.address()
        const resolvedPort = typeof address === 'object' && address
            ? address.port
            : config.port

        return {
            host: '127.0.0.1',
            port: resolvedPort,
            basePath: config.basePath,
            httpBaseUrl: `http://127.0.0.1:${resolvedPort}${config.basePath}`,
            wsUrl: `ws://127.0.0.1:${resolvedPort}${config.basePath}/ws`,
        }
    }

    const getStats = (): DualTopologyStats => {
        const snapshot = host.hostRuntime.getSnapshot()
        return {
            ticketCount: snapshot.tickets.length,
            sessionCount: snapshot.sessions.length,
            relayCounters: snapshot.relayCounters,
            activeFaultRuleCount: snapshot.activeFaultRules.length,
            activeConnectionCount: snapshot.sessions.reduce((count, session) => {
                return count + Object.values(session.nodes).filter(node => node.connected).length
            }, 0),
        }
    }

    const replaceFaultRules = (rules: HostFaultRule[]): FaultRuleReplaceResponse => {
        host.hostRuntime.replaceFaultRules(rules)
        return {
            success: true,
            ruleCount: rules.length,
        }
    }

    const flushConnectionOutbox = (connectionId: string): RoutedOutgoingMessage[] => {
        return host.hostRuntime
            .drainConnectionOutbox(connectionId as any)
            .map(delivery => {
                if ('commandName' in delivery.envelope) {
                    return {
                        connectionId,
                        message: {
                            type: 'command-dispatch',
                            envelope: delivery.envelope,
                        } satisfies DualTopologyOutgoingMessage,
                    } satisfies RoutedOutgoingMessage
                }
                if ('projection' in delivery.envelope) {
                    return {
                        connectionId,
                        message: {
                            type: 'projection-mirror',
                            envelope: delivery.envelope,
                        } satisfies DualTopologyOutgoingMessage,
                        } satisfies RoutedOutgoingMessage
                }
                if ('snapshot' in delivery.envelope) {
                    return {
                        connectionId,
                        message: {
                            type: 'request-lifecycle-snapshot',
                            envelope: delivery.envelope,
                        } satisfies DualTopologyOutgoingMessage,
                        } satisfies RoutedOutgoingMessage
                }
                if (isResumeBeginEnvelope(delivery.envelope)) {
                    return {
                        connectionId,
                        message: {
                            type: 'resume-begin',
                            sessionId: delivery.envelope.sessionId,
                            nodeId: delivery.envelope.sourceNodeId,
                            timestamp: delivery.envelope.timestamp,
                        } satisfies DualTopologyOutgoingMessage,
                    } satisfies RoutedOutgoingMessage
                }
                if ('summaryBySlice' in delivery.envelope) {
                    return {
                        connectionId,
                        message: {
                            type: 'state-sync-summary',
                            envelope: delivery.envelope,
                        } satisfies DualTopologyOutgoingMessage,
                    } satisfies RoutedOutgoingMessage
                }
                if ('diffBySlice' in delivery.envelope) {
                    return {
                        connectionId,
                        message: {
                            type: 'state-sync-diff',
                            envelope: delivery.envelope,
                        } satisfies DualTopologyOutgoingMessage,
                    } satisfies RoutedOutgoingMessage
                }
                if ('committedAt' in delivery.envelope) {
                    return {
                        connectionId,
                        message: {
                            type: 'state-sync-commit-ack',
                            envelope: delivery.envelope,
                        } satisfies DualTopologyOutgoingMessage,
                    } satisfies RoutedOutgoingMessage
                }
                return {
                    connectionId,
                    message: {
                        type: 'command-event',
                        envelope: delivery.envelope,
                    } satisfies DualTopologyOutgoingMessage,
                } satisfies RoutedOutgoingMessage
            })
    }

    const handleRelayEnvelope = (
        connectionId: string,
        message: RelayEnvelopeMessage,
    ): RoutedOutgoingMessage[] => {
        const context = connectionContexts.get(connectionId)
        if (!context?.sessionId || !context.nodeId) {
            return []
        }

        const envelope = message.envelope as
            | CommandDispatchEnvelope
            | CommandEventEnvelope
            | ProjectionMirrorEnvelope
            | RequestLifecycleSnapshotEnvelope
            | StateSyncSummaryEnvelope
            | StateSyncDiffEnvelope
            | StateSyncCommitAckEnvelope
        host.hostRuntime.relayEnvelope({
            sessionId: context.sessionId as any,
            sourceNodeId: context.nodeId as any,
            envelope,
        })

        const snapshot = host.hostRuntime.getSnapshot()
        const outputs: RoutedOutgoingMessage[] = []
        for (const session of snapshot.sessions) {
            for (const node of Object.values(session.nodes)) {
                if (!node.connectionId) {
                    continue
                }
                outputs.push(...flushConnectionOutbox(node.connectionId))
            }
        }
        return outputs
    }

    const handleIncomingMessage = (
        connectionId: string,
        message: DualTopologyIncomingMessage,
    ): RoutedOutgoingMessage[] => {
        if (message.type === '__host_heartbeat_ack') {
            host.hostRuntime.recordHeartbeat(connectionId as any, message.timestamp)
            return []
        }

        if (message.type === 'node-hello') {
            const context = connectionContexts.get(connectionId) ?? {connectionId}
            connectionContexts.set(connectionId, context)
            const result = host.hostRuntime.processHello({
                connectionId: connectionId as any,
                hello: message.hello as NodeHello,
            })
            context.sessionId = result.ack.sessionId
            context.nodeId = message.hello.runtime.nodeId
            return [
                {
                    connectionId,
                    message: {
                        type: 'node-hello-ack',
                        ack: result.ack,
                    },
                },
                ...flushConnectionOutbox(connectionId),
            ]
        }

        if (message.type === 'resume-begin') {
            host.hostRuntime.beginResume({
                sessionId: message.sessionId as any,
                nodeId: message.nodeId as any,
                startedAt: message.timestamp,
            })
            const context = connectionContexts.get(connectionId)
            if (!context?.sessionId || !context.nodeId) {
                return []
            }

            const session = host.hostRuntime.getSession(context.sessionId as any)
            if (!session) {
                return []
            }

            Object.values(session.nodes)
                .filter(node => node.nodeId !== context.nodeId && node.connected)
                .forEach(node => {
                    host.hostRuntime.relayEnvelope({
                        sessionId: context.sessionId as any,
                        sourceNodeId: context.nodeId as any,
                        envelope: createResumeBeginEnvelope({
                            sessionId: message.sessionId,
                            sourceNodeId: message.nodeId,
                            targetNodeId: node.nodeId,
                            timestamp: message.timestamp,
                        }),
                    })
                })

            const snapshot = host.hostRuntime.getSnapshot()
            const outputs: RoutedOutgoingMessage[] = []
            for (const session of snapshot.sessions) {
                for (const node of Object.values(session.nodes)) {
                    if (!node.connectionId) {
                        continue
                    }
                    outputs.push(...flushConnectionOutbox(node.connectionId))
                }
            }
            return outputs
        }

        if (message.type === 'resume-complete') {
            host.hostRuntime.completeResume({
                sessionId: message.sessionId as any,
                nodeId: message.nodeId as any,
                completedAt: message.timestamp,
            })
            return flushConnectionOutbox(connectionId)
        }

        if (isRelayEnvelopeMessage(message)) {
            return handleRelayEnvelope(connectionId, message)
        }

        return []
    }

    const sendOutgoingMessages = (outputs: RoutedOutgoingMessage[]) => {
        outputs.forEach(output => {
            const socket = socketsByConnectionId.get(output.connectionId)
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                return
            }
            socket.send(JSON.stringify(output.message))
        })
    }

    const onSocketMessage = (socket: WebSocket, raw: WebSocket.RawData) => {
        const context = socketContexts.get(socket)
        if (!context) {
            return
        }
        const parsed = JSON.parse(raw.toString()) as DualTopologyIncomingMessage
        const outputs = handleIncomingMessage(context.connectionId, parsed)
        sendOutgoingMessages(outputs)
    }

    const onSocketClose = (socket: WebSocket) => {
        const context = socketContexts.get(socket)
        if (!context) {
            return
        }
        host.hostRuntime.detachConnection({
            connectionId: context.connectionId as any,
            reason: 'socket-closed',
            disconnectedAt: Date.now(),
        })
        socketsByConnectionId.delete(context.connectionId)
        socketContexts.delete(socket)
        connectionContexts.delete(context.connectionId)
    }

    const onUpgrade = (request: http.IncomingMessage, socket: any, head: Buffer) => {
        const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${getAddressInfo().port}`)
        if (requestUrl.pathname !== `${config.basePath}/ws`) {
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
            socket.destroy()
            return
        }

        wss.handleUpgrade(request, socket, head, ws => {
            const connectionId = runtimeContracts.createConnectionId()
            const context = {connectionId}
            socketContexts.set(ws, context)
            socketsByConnectionId.set(connectionId, ws)
            connectionContexts.set(connectionId, context)
            ws.on('message', raw => onSocketMessage(ws, raw))
            ws.on('close', () => onSocketClose(ws))
        })
    }

    const onRequest = async (request: http.IncomingMessage, response: http.ServerResponse) => {
        const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${getAddressInfo().port}`)
        response.setHeader('access-control-allow-origin', '*')
        response.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS')
        response.setHeader('access-control-allow-headers', 'content-type')

        if (request.method === 'OPTIONS') {
            response.statusCode = 200
            response.end()
            return
        }

        if (request.method === 'GET' && requestUrl.pathname === `${config.basePath}/health`) {
            writeJson(response, 200, {
                status: 'ok',
                now: Date.now(),
                moduleName,
            })
            return
        }

        if (request.method === 'GET' && requestUrl.pathname === `${config.basePath}/stats`) {
            writeJson(response, 200, getStats())
            return
        }

        if (request.method === 'POST' && requestUrl.pathname === `${config.basePath}/tickets`) {
            const body = await readJsonBody<CreatePairingTicketRequest>(request)
            if (!body.masterNodeId) {
                writeJson(response, 400, {
                    success: false,
                    error: 'masterNodeId is required',
                } satisfies CreatePairingTicketResponse)
                return
            }

            const ticket = host.hostRuntime.issueTicket({
                masterNodeId: body.masterNodeId as any,
                transportUrls: body.transportUrls ?? [getAddressInfo().wsUrl],
                expiresInMs: body.expiresInMs ?? 5 * 60 * 1000,
            })

            writeJson(response, 200, {
                success: true,
                token: ticket.ticket.token,
                sessionId: ticket.sessionId,
                expiresAt: ticket.ticket.expiresAt,
                transportUrls: ticket.ticket.transportUrls,
            } satisfies CreatePairingTicketResponse)
            return
        }

        if (request.method === 'PUT' && requestUrl.pathname === `${config.basePath}/fault-rules`) {
            const body = await readJsonBody<FaultRuleReplaceRequest>(request)
            writeJson(response, 200, replaceFaultRules(body.rules ?? []))
            return
        }

        writeJson(response, 404, {
            error: 'not-found',
        })
    }

    const start = async () => {
        if (heartbeatTimer) {
            return
        }
        server.on('request', onRequest)
        server.on('upgrade', onUpgrade)
        await new Promise<void>(resolve => {
            server.listen(config.port, '127.0.0.1', resolve)
        })
        heartbeatTimer = setInterval(() => {
            const timestamp = Date.now()
            socketContexts.forEach((context, socket) => {
                if (socket.readyState !== WebSocket.OPEN) {
                    return
                }
                socket.send(JSON.stringify({
                    type: '__host_heartbeat',
                    timestamp,
                } satisfies DualTopologyOutgoingMessage))
            })
            host.hostRuntime.expireIdleConnections({
                now: timestamp,
            })
        }, config.heartbeatIntervalMs)
        logger.info({
            category: 'host.server',
            event: 'started',
            data: {
                ...getAddressInfo(),
            },
        })
    }

    const close = async () => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer)
            heartbeatTimer = undefined
        }
        socketContexts.forEach((_context, socket) => {
            socket.close()
        })
        socketsByConnectionId.clear()
        socketContexts.clear()
        connectionContexts.clear()
        await new Promise<void>(resolve => {
            wss.close(() => resolve())
        })
        await new Promise<void>(resolve => {
            server.close(() => resolve())
        })
    }

    return {
        host,
        config,
        start,
        close,
        getAddressInfo,
        getStats,
        replaceFaultRules,
        handleIncomingMessage,
    }
}
