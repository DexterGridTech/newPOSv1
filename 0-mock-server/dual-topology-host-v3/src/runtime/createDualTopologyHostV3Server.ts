import http from 'http'
import {URL} from 'url'
import WebSocket, {WebSocketServer} from 'ws'
import {createDualTopologyHostV3} from './createDualTopologyHostV3'
import {dualTopologyHostV3ServerParameters} from '../supports/parameters'
import {moduleName} from '../moduleName'
import type {
    DualTopologyHostV3AddressInfo,
    DualTopologyHostV3IncomingMessage,
    DualTopologyHostV3OutgoingMessage,
    DualTopologyHostV3Server,
    DualTopologyHostV3ServerConfig,
    TopologyV3Diagnostics,
    TopologyV3FaultRule,
    TopologyV3InstanceMode,
    TopologyV3RuntimeInfo,
} from '../types/server'

const DEFAULT_SERVER_CONFIG: DualTopologyHostV3ServerConfig = {
    port: dualTopologyHostV3ServerParameters.defaultPort.defaultValue,
    basePath: dualTopologyHostV3ServerParameters.defaultBasePath.defaultValue,
}

const writeJson = (response: http.ServerResponse, statusCode: number, payload: unknown) => {
    response.statusCode = statusCode
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(payload))
}

const writeCorsHeaders = (response: http.ServerResponse) => {
    response.setHeader('access-control-allow-origin', '*')
    response.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS')
    response.setHeader('access-control-allow-headers', 'content-type')
}

const resolveTargetNodeId = (message: DualTopologyHostV3IncomingMessage): string | undefined => {
    if (message.type === 'hello') {
        return undefined
    }
    if ('targetNodeId' in message && typeof message.targetNodeId === 'string') {
        return message.targetNodeId
    }
    if ('envelope' in message && message.envelope && typeof message.envelope === 'object') {
        const envelope = message.envelope as {
            targetNodeId?: unknown
            ownerNodeId?: unknown
        }
        if (typeof envelope.targetNodeId === 'string') {
            return envelope.targetNodeId
        }
        if (message.type === 'command-event' && typeof envelope.ownerNodeId === 'string') {
            return envelope.ownerNodeId
        }
    }
    return undefined
}

export const createDualTopologyHostV3Server = (
    input: {
        config?: Partial<DualTopologyHostV3ServerConfig>
    } = {},
): DualTopologyHostV3Server => {
    const config: DualTopologyHostV3ServerConfig = {
        ...DEFAULT_SERVER_CONFIG,
        ...input.config,
    }

    const host = createDualTopologyHostV3()
    const websocketServer = new WebSocketServer({noServer: true})
    const sockets = new Set<WebSocket>()
    const faultRules: TopologyV3FaultRule[] = []
    const peerByRole = new Map<TopologyV3InstanceMode, {
        socket: WebSocket
        runtime: TopologyV3RuntimeInfo
    }>()
    let activeSessionId: string | undefined

    const getStats = () => {
        return {
            sessionCount: activeSessionId ? 1 : 0,
            activeFaultRuleCount: faultRules.length,
        }
    }

    const getDiagnostics = (): TopologyV3Diagnostics => {
        return {
            moduleName,
            state: host.getSnapshot().state,
            peers: Array.from(peerByRole.entries()).map(([role, peer]) => ({
                role,
                nodeId: peer.runtime.nodeId,
                deviceId: peer.runtime.deviceId,
            })),
            faultRules: [...faultRules],
        }
    }

    const replaceFaultRules = (rules: TopologyV3FaultRule[]) => {
        faultRules.splice(0, faultRules.length, ...rules)
        return {
            success: true,
            ruleCount: faultRules.length,
        }
    }

    const emit = (socket: WebSocket, message: DualTopologyHostV3OutgoingMessage) => {
        socket.send(JSON.stringify(message))
    }

    const refreshSessionState = () => {
        if (peerByRole.size === 0) {
            activeSessionId = undefined
        }
    }

    const createSessionId = () => {
        return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }

    const detachSocket = (socket: WebSocket) => {
        for (const [role, peer] of peerByRole.entries()) {
            if (peer.socket === socket) {
                peerByRole.delete(role)
            }
        }
        sockets.delete(socket)
        refreshSessionState()
    }

    const handleHello = (socket: WebSocket, message: DualTopologyHostV3IncomingMessage) => {
        if (message.type !== 'hello') {
            return
        }

        const role = message.runtime.instanceMode
        const occupied = peerByRole.get(role)
        if (occupied && occupied.socket !== socket && occupied.socket.readyState === WebSocket.OPEN) {
            emit(socket, {
                type: 'hello-ack',
                helloId: message.helloId,
                accepted: false,
                rejectionCode: 'ROLE_OCCUPIED',
                rejectionMessage: `${role} is already connected`,
                hostTime: Date.now(),
            })
            return
        }

        peerByRole.set(role, {
            socket,
            runtime: message.runtime,
        })

        if (!activeSessionId) {
            activeSessionId = createSessionId()
        }

        const peerRole: TopologyV3InstanceMode = role === 'MASTER' ? 'SLAVE' : 'MASTER'
        const peerRuntime = peerByRole.get(peerRole)?.runtime

        emit(socket, {
            type: 'hello-ack',
            helloId: message.helloId,
            accepted: true,
            sessionId: activeSessionId,
            peerRuntime,
            hostTime: Date.now(),
        })

        if (peerRuntime) {
            const oppositeRole: TopologyV3InstanceMode = role === 'MASTER' ? 'SLAVE' : 'MASTER'
            const oppositePeer = peerByRole.get(oppositeRole)
            if (oppositePeer && oppositePeer.socket !== socket && oppositePeer.socket.readyState === WebSocket.OPEN) {
                emit(oppositePeer.socket, {
                    type: 'hello-ack',
                    helloId: `${message.helloId}:peer-update`,
                    accepted: true,
                    sessionId: activeSessionId,
                    peerRuntime: message.runtime,
                    hostTime: Date.now(),
                })
            }
        }
    }

    const handleRelay = (socket: WebSocket, message: DualTopologyHostV3IncomingMessage) => {
        if (message.type === 'hello') {
            return
        }

        const sender = Array.from(peerByRole.values()).find(peer => peer.socket === socket)
        if (!sender) {
            return
        }

        const targetNodeId = resolveTargetNodeId(message)
        const targetRuntime = targetNodeId
            ? Array.from(peerByRole.values()).find(peer => peer.runtime.nodeId === targetNodeId)
            : undefined
        if (!targetRuntime || targetRuntime.socket.readyState !== WebSocket.OPEN) {
            return
        }

        const matchingRules = faultRules.filter(rule => rule.channel === undefined || rule.channel === message.type)
        if (matchingRules.some(rule => rule.kind === 'relay-drop')) {
            return
        }
        if (matchingRules.some(rule => rule.kind === 'relay-disconnect-target')) {
            targetRuntime.socket.close(1011, 'fault:relay-disconnect-target')
            return
        }

        const delayMs = matchingRules.reduce((max, rule) => {
            if (rule.kind !== 'relay-delay') {
                return max
            }
            return Math.max(max, rule.delayMs)
        }, 0)

        if (delayMs > 0) {
            setTimeout(() => {
                if (targetRuntime.socket.readyState === WebSocket.OPEN) {
                    emit(targetRuntime.socket, message)
                }
            }, delayMs)
            return
        }

        emit(targetRuntime.socket, message)
    }

    const server = http.createServer((request, response) => {
        writeCorsHeaders(response)
        if (request.method === 'OPTIONS') {
            response.statusCode = 204
            response.end()
            return
        }

        if (!request.url) {
            writeJson(response, 400, {error: 'missing_url'})
            return
        }

        const addressInfo = getAddressInfo()
        const requestUrl = new URL(request.url, addressInfo.httpBaseUrl)
        const pathname = requestUrl.pathname

        if (request.method === 'GET' && pathname === `${config.basePath}/status`) {
            writeJson(response, 200, {
                ...host.getSnapshot(),
                sessionCount: getStats().sessionCount,
            })
            return
        }

        if (request.method === 'GET' && pathname === `${config.basePath}/stats`) {
            writeJson(response, 200, getStats())
            return
        }

        if (request.method === 'GET' && pathname === `${config.basePath}/diagnostics`) {
            writeJson(response, 200, getDiagnostics())
            return
        }

        if (request.method === 'POST' && pathname === `${config.basePath}/fault-rules`) {
            let rawBody = ''
            request.on('data', chunk => {
                rawBody += chunk.toString()
            })
            request.on('end', () => {
                const payload = rawBody.length > 0 ? JSON.parse(rawBody) as {rules?: TopologyV3FaultRule[]} : {}
                writeJson(response, 200, replaceFaultRules(payload.rules ?? []))
            })
            return
        }

        if (request.method === 'DELETE' && pathname === `${config.basePath}/fault-rules`) {
            writeJson(response, 200, replaceFaultRules([]))
            return
        }

        writeJson(response, 404, {error: 'not_found'})
    })

    server.on('upgrade', (request, socket, head) => {
        if (!request.url) {
            socket.destroy()
            return
        }

        const addressInfo = getAddressInfo()
        const requestUrl = new URL(request.url, addressInfo.httpBaseUrl)
        if (requestUrl.pathname !== `${config.basePath}/ws`) {
            socket.destroy()
            return
        }

        websocketServer.handleUpgrade(request, socket, head, webSocket => {
            websocketServer.emit('connection', webSocket, request)
        })
    })

    websocketServer.on('connection', socket => {
        sockets.add(socket)

        socket.on('message', raw => {
            const message = JSON.parse(raw.toString()) as DualTopologyHostV3IncomingMessage
            if (message.type === 'hello') {
                handleHello(socket, message)
                return
            }
            handleRelay(socket, message)
        })

        socket.on('close', () => {
            detachSocket(socket)
        })
    })

    const getAddressInfo = (): DualTopologyHostV3AddressInfo => {
        const address = server.address()
        const resolvedPort = typeof address === 'object' && address ? address.port : config.port

        return {
            host: '127.0.0.1',
            port: resolvedPort,
            basePath: config.basePath,
            httpBaseUrl: `http://127.0.0.1:${resolvedPort}${config.basePath}`,
            wsUrl: `ws://127.0.0.1:${resolvedPort}${config.basePath}/ws`,
        }
    }

    return {
        config,
        async start() {
            await new Promise<void>((resolve, reject) => {
                server.once('error', reject)
                server.listen(config.port, '127.0.0.1', () => {
                    server.off('error', reject)
                    host.markRunning()
                    resolve()
                })
            })
        },
        async close() {
            host.markClosed()
            if (!server.listening) {
                return
            }
            await new Promise<void>((resolve, reject) => {
                server.close(error => {
                    if (error) {
                        reject(error)
                        return
                    }
                    resolve()
                })
            })
        },
        getAddressInfo,
        getStats,
        replaceFaultRules,
    }
}
