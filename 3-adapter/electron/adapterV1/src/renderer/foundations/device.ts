import type {Device, DeviceInfo, PowerStatusChangeEvent, SystemStatus} from '@impos2/kernel-core-base';
import {getHostBridge} from './hostBridge';

const powerListenerIds = new WeakMap<(event: PowerStatusChangeEvent) => void, string>();
const powerListenerCleanups = new WeakMap<(event: PowerStatusChangeEvent) => void, () => void>();

export const deviceAdapter: Device = {
  getDeviceInfo(): Promise<DeviceInfo> {
    return getHostBridge().device.getDeviceInfo();
  },
  getSystemStatus(): Promise<SystemStatus> {
    return getHostBridge().device.getSystemStatus();
  },
  addPowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): () => void {
    const listenerId = `power-listener-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    powerListenerIds.set(listener, listenerId);
    void getHostBridge()
      .device.subscribePowerStatus(listenerId)
      .then(event => {
        listener(event);
      });

    const cleanup = getHostBridge().events.on('device.powerStatusChanged', payload => {
      if (payload.listenerId !== listenerId) {
        return;
      }
      listener(payload.event);
    });

    powerListenerCleanups.set(listener, cleanup);
    return () => this.removePowerStatusChangeListener(listener);
  },
  removePowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): void {
    powerListenerCleanups.get(listener)?.();
    powerListenerCleanups.delete(listener);
    const listenerId = powerListenerIds.get(listener);
    if (listenerId) {
      powerListenerIds.delete(listener);
      void getHostBridge().device.unsubscribePowerStatus(listenerId);
    }
  },
};
