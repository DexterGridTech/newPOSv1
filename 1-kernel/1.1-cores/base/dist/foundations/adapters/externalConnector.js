import { ConnectorCode, } from '../../types/foundations/externalConnector';
let registeredExternalConnector = null;
export const externalConnector = {
    call(channel, action, params, timeout) {
        if (!registeredExternalConnector) {
            return Promise.resolve({
                success: false,
                code: ConnectorCode.NOT_REGISTERED,
                message: 'ExternalConnector not registered',
                duration: 0,
                timestamp: Date.now(),
            });
        }
        return registeredExternalConnector.call(channel, action, params, timeout);
    },
    subscribe(channel, onEvent, onError) {
        if (!registeredExternalConnector)
            return Promise.resolve('');
        return registeredExternalConnector.subscribe(channel, onEvent, onError);
    },
    unsubscribe(channelId) {
        if (!registeredExternalConnector)
            return Promise.resolve();
        return registeredExternalConnector.unsubscribe(channelId);
    },
    on(eventType, handler) {
        if (!registeredExternalConnector)
            return () => { };
        return registeredExternalConnector.on(eventType, handler);
    },
    isAvailable(channel) {
        if (!registeredExternalConnector)
            return Promise.resolve(false);
        return registeredExternalConnector.isAvailable(channel);
    },
    getAvailableTargets(type) {
        if (!registeredExternalConnector)
            return Promise.resolve([]);
        return registeredExternalConnector.getAvailableTargets(type);
    },
};
export const registerExternalConnector = (impl) => {
    registeredExternalConnector = impl;
};
