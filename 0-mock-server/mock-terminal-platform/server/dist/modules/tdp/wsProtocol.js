export const parseClientMessage = (raw) => {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
        throw new Error('消息格式非法');
    }
    return payload;
};
