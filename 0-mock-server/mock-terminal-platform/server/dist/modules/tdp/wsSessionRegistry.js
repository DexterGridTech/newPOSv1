const sessionsById = new Map();
let sessionIdBySocket = new WeakMap();
export const registerOnlineSession = (session) => {
    sessionsById.set(session.sessionId, session);
    sessionIdBySocket.set(session.socket, session.sessionId);
};
export const getOnlineSessionById = (sessionId) => sessionsById.get(sessionId);
export const getOnlineSessionBySocket = (socket) => {
    const sessionId = sessionIdBySocket.get(socket);
    return sessionId ? sessionsById.get(sessionId) : undefined;
};
export const unregisterOnlineSession = (sessionId) => {
    const session = sessionsById.get(sessionId);
    if (session?.batchTimer) {
        clearTimeout(session.batchTimer);
    }
    sessionsById.delete(sessionId);
};
export const resetOnlineSessions = () => {
    for (const session of sessionsById.values()) {
        if (session.batchTimer) {
            clearTimeout(session.batchTimer);
        }
    }
    sessionsById.clear();
    sessionIdBySocket = new WeakMap();
};
export const listOnlineSessions = () => Array.from(sessionsById.values());
export const listOnlineSessionsByTerminalId = (sandboxId, terminalId) => Array.from(sessionsById.values()).filter((item) => item.sandboxId === sandboxId && item.terminalId === terminalId);
export const forceCloseOnlineSession = (input) => {
    const session = sessionsById.get(input.sessionId);
    if (!session) {
        throw new Error('目标 session 当前不在线');
    }
    session.socket.close(input.code ?? 1012, input.reason ?? 'admin force close');
    return {
        sessionId: input.sessionId,
        code: input.code ?? 1012,
        reason: input.reason ?? 'admin force close',
    };
};
