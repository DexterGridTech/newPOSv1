export const device = {
    getDeviceInfo: async () => {
        if (registeredDevice)
            return registeredDevice.getDeviceInfo();
        else
            return {
                id: "test id",
                manufacturer: "test manufacturer",
                os: "test os",
                osVersion: "test os version",
                cpu: "test cpu",
                memory: "test memory",
                disk: "test disk",
                network: "test network",
                displays: [
                    {
                        id: "test display id",
                        displayType: "test display type",
                        refreshRate: 60,
                        width: 1920,
                        height: 1080,
                        physicalWidth: 24,
                        physicalHeight: 12,
                        touchSupport: true
                    }
                ]
            };
    },
    getSystemStatus() {
        if (registeredDevice)
            return registeredDevice.getSystemStatus();
        return Promise.resolve({
            cpu: { app: 0, cores: 0 },
            memory: { app: 0, appPercentage: 0, total: 0 },
            disk: { app: 0, available: 0, overall: 0, used: 0, total: 0 },
            power: {
                batteryHealth: 'good',
                batteryLevel: 100,
                batteryStatus: 'full',
                isCharging: false,
                powerConnected: true
            },
            usbDevices: [],
            bluetoothDevices: [],
            serialDevices: [],
            networks: [],
            installedApps: [],
            updatedAt: Date.now()
        });
    },
    addPowerStatusChangeListener(listener) {
        if (registeredDevice)
            registeredDevice.addPowerStatusChangeListener(listener);
        return () => {
        };
    },
    removePowerStatusChangeListener(listener) {
        if (registeredDevice)
            registeredDevice.removePowerStatusChangeListener(listener);
    }
};
let registeredDevice = null;
export const registerDevice = (device) => {
    registeredDevice = device;
};
