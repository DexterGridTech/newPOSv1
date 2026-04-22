import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { appendAuditLog } from '../admin/audit.js';
import { now } from '../../shared/utils.js';
import { acknowledgeSessionRevision, connectSession, disconnectSession, getHighWatermarkForTerminal, getTerminalChangesSince, getTerminalSnapshotEnvelope, heartbeatSession, updateSessionAppliedRevision, validateTerminalAccessToken, } from './service.js';
import { upsertTerminalRuntimeFacts } from './groupService.js';
import { getOnlineSessionBySocket, registerOnlineSession, unregisterOnlineSession } from './wsSessionRegistry.js';
import { parseClientMessage } from './wsProtocol.js';
const WS_PATH = '/api/v1/tdp/ws/connect';
const NODE_ID = 'mock-tdp-node-01';
const sendMessage = (socket, message) => {
    if (socket.readyState !== socket.OPEN)
        return;
    socket.send(JSON.stringify(message));
};
const sendErrorAndClose = (socket, code, message, details) => {
    sendMessage(socket, {
        type: 'ERROR',
        error: {
            code,
            message,
            details,
        },
    });
    socket.close(1008, message);
};
const handleHandshake = (socket, req, payload) => {
    const url = new URL(req.url ?? '', 'http://127.0.0.1');
    const sandboxId = url.searchParams.get('sandboxId');
    const terminalId = url.searchParams.get('terminalId');
    const token = url.searchParams.get('token');
    if (!sandboxId || !terminalId || !token) {
        sendErrorAndClose(socket, 'UNAUTHORIZED', '缺少 sandboxId、terminalId 或 token');
        return;
    }
    if (payload.sandboxId !== sandboxId) {
        sendErrorAndClose(socket, 'SANDBOX_ID_MISMATCH', '握手 sandboxId 与连接参数不一致');
        return;
    }
    if (payload.terminalId !== terminalId) {
        sendErrorAndClose(socket, 'TERMINAL_ID_MISMATCH', '握手 terminalId 与连接参数不一致');
        return;
    }
    const auth = validateTerminalAccessToken({ sandboxId, terminalId, token });
    if (!auth.valid) {
        sendErrorAndClose(socket, auth.code, auth.message);
        return;
    }
    const protocolVersion = payload.protocolVersion?.trim() || '1.0';
    const appVersion = payload.appVersion?.trim();
    if (!appVersion) {
        sendErrorAndClose(socket, 'INVALID_HANDSHAKE', '缺少 appVersion');
        return;
    }
    const connection = connectSession({
        sandboxId,
        terminalId,
        clientVersion: appVersion,
        protocolVersion,
    });
    upsertTerminalRuntimeFacts({
        sandboxId,
        terminalId,
        appVersion,
        protocolVersion,
        capabilities: payload.capabilities ?? [],
    });
    const highWatermark = getHighWatermarkForTerminal(sandboxId, terminalId);
    const lastCursor = Math.max(0, Number(payload.lastCursor ?? 0));
    const syncMode = lastCursor === 0 || lastCursor < Math.max(0, highWatermark - 1000) ? 'full' : 'incremental';
    registerOnlineSession({
        sessionId: connection.sessionId,
        terminalId,
        sandboxId,
        appVersion,
        protocolVersion,
        lastCursor,
        lastDeliveredRevision: undefined,
        subscribedTopics: payload.subscribedTopics ?? [],
        capabilities: payload.capabilities ?? [],
        socket,
        connectedAt: now(),
    });
    appendAuditLog({
        domain: 'TDP',
        action: 'WS_CONNECT_SESSION',
        targetId: connection.sessionId,
        detail: { terminalId, protocolVersion, appVersion, lastCursor, syncMode },
        operator: 'terminal-client',
    });
    sendMessage(socket, {
        type: 'SESSION_READY',
        data: {
            sessionId: connection.sessionId,
            nodeId: NODE_ID,
            nodeState: 'healthy',
            highWatermark,
            syncMode,
            alternativeEndpoints: [],
        },
    });
    if (syncMode === 'full') {
        sendMessage(socket, {
            type: 'FULL_SNAPSHOT',
            data: {
                terminalId,
                snapshot: getTerminalSnapshotEnvelope(sandboxId, terminalId),
                highWatermark,
            },
        });
        return;
    }
    const changes = getTerminalChangesSince(sandboxId, terminalId, lastCursor);
    sendMessage(socket, {
        type: 'CHANGESET',
        data: {
            terminalId,
            changes: changes.map(item => item.change),
            nextCursor: changes.length ? changes[changes.length - 1].cursor : lastCursor,
            hasMore: false,
            highWatermark,
        },
    });
};
const handleClientMessage = (socket, req, raw) => {
    let message;
    try {
        message = parseClientMessage(raw);
    }
    catch (error) {
        sendErrorAndClose(socket, 'INVALID_MESSAGE', error instanceof Error ? error.message : '消息格式非法');
        return;
    }
    if (message.type === 'HANDSHAKE') {
        if (getOnlineSessionBySocket(socket)) {
            sendErrorAndClose(socket, 'DUPLICATE_HANDSHAKE', '会话已完成握手');
            return;
        }
        handleHandshake(socket, req, message.data);
        return;
    }
    const onlineSession = getOnlineSessionBySocket(socket);
    if (!onlineSession) {
        sendErrorAndClose(socket, 'HANDSHAKE_REQUIRED', '请先完成 HANDSHAKE');
        return;
    }
    if (message.type === 'PING') {
        heartbeatSession({ sandboxId: onlineSession.sandboxId, sessionId: onlineSession.sessionId });
        sendMessage(socket, {
            type: 'PONG',
            data: {
                timestamp: now(),
            },
        });
        return;
    }
    if (message.type === 'STATE_REPORT') {
        if (typeof message.data.lastAppliedCursor === 'number') {
            onlineSession.lastAppliedRevision = message.data.lastAppliedCursor;
            updateSessionAppliedRevision({
                sandboxId: onlineSession.sandboxId,
                sessionId: onlineSession.sessionId,
                revision: message.data.lastAppliedCursor,
            });
        }
        heartbeatSession({ sandboxId: onlineSession.sandboxId, sessionId: onlineSession.sessionId });
        return;
    }
    if (message.type === 'ACK') {
        onlineSession.lastAckedRevision = message.data.cursor;
        acknowledgeSessionRevision({
            sandboxId: onlineSession.sandboxId,
            sessionId: onlineSession.sessionId,
            cursor: message.data.cursor,
            topic: message.data.topic,
            itemKey: message.data.itemKey ?? message.data.instanceId,
        });
        return;
    }
};
const handleSocketClose = (socket) => {
    const session = getOnlineSessionBySocket(socket);
    if (!session)
        return;
    unregisterOnlineSession(session.sessionId);
    try {
        disconnectSession({ sandboxId: session.sandboxId, sessionId: session.sessionId });
        appendAuditLog({
            domain: 'TDP',
            action: 'WS_DISCONNECT_SESSION',
            targetId: session.sessionId,
            detail: { terminalId: session.terminalId, lastAckedRevision: session.lastAckedRevision, lastAppliedRevision: session.lastAppliedRevision },
            operator: 'terminal-client',
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === '沙箱不存在') {
            return;
        }
        throw error;
    }
};
export const createHttpAndWsServer = (app) => {
    const server = createServer(app);
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url ?? '', 'http://127.0.0.1');
        if (url.pathname !== WS_PATH) {
            socket.destroy();
            return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });
    wss.on('connection', (socket, req) => {
        socket.on('message', (data) => {
            handleClientMessage(socket, req, data.toString());
        });
        socket.on('close', () => {
            handleSocketClose(socket);
        });
        socket.on('error', () => {
            handleSocketClose(socket);
        });
    });
    return server;
};
