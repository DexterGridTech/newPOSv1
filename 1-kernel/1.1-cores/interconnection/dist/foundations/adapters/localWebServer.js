import { LocalWebServerStatus } from "../../types/foundations/localWebServer";
import { testServerAddresses } from "../masterServer";
export const localWebServer = {
    startLocalWebServer(config) {
        if (!registeredLocalWebServer) {
            return Promise.resolve(testServerAddresses);
        }
        return registeredLocalWebServer.startLocalWebServer(config);
    },
    stopLocalWebServer() {
        if (!registeredLocalWebServer)
            return Promise.resolve();
        return registeredLocalWebServer.stopLocalWebServer();
    },
    getLocalWebServerStats() {
        if (!registeredLocalWebServer)
            return Promise.resolve({ masterCount: 0, slaveCount: 0, pendingCount: 0, uptime: 0 });
        return registeredLocalWebServer.getLocalWebServerStats();
    },
    getLocalWebServerStatus() {
        if (!registeredLocalWebServer)
            return Promise.resolve({
                status: LocalWebServerStatus.STOPPED,
                addresses: [],
                config: { port: 0, basePath: '', heartbeatInterval: 0, heartbeatTimeout: 0 },
            });
        return registeredLocalWebServer.getLocalWebServerStatus();
    }
};
let registeredLocalWebServer;
export function registerLocalWebServer(localWebServer) {
    registeredLocalWebServer = localWebServer;
}
