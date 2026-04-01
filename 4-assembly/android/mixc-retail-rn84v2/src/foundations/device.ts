import {NativeEventEmitter} from 'react-native';
import type {Device, DeviceInfo, PowerStatusChangeEvent, SystemStatus} from '@impos2/kernel-core-base';
import NativeDeviceTurboModule from '../supports/apis/NativeDeviceTurboModule';

export class DeviceAdapter implements Device {
  private emitter: NativeEventEmitter | null = null;
  private listeners = new Set<(event: PowerStatusChangeEvent) => void>();
  private subscription: ReturnType<NativeEventEmitter['addListener']> | null = null;

  private get native() {
    return NativeDeviceTurboModule;
  }

  private getEmitter(): NativeEventEmitter | null {
    const target = this.native as any;
    if (!target) return null;
    if (!this.emitter) {
      this.emitter = new NativeEventEmitter(target);
    }
    return this.emitter;
  }

  getDeviceInfo(): Promise<DeviceInfo> {
    return this.native.getDeviceInfo() as Promise<DeviceInfo>;
  }

  getSystemStatus(): Promise<SystemStatus> {
    return this.native.getSystemStatus() as Promise<SystemStatus>;
  }

  addPowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): () => void {
    if (this.listeners.size === 0) {
      this.subscription = this.getEmitter()?.addListener('onPowerStatusChanged', (event: PowerStatusChangeEvent) => {
        this.listeners.forEach(current => current(event));
      }) ?? null;
    }
    this.listeners.add(listener);
    return () => this.removePowerStatusChangeListener(listener);
  }

  removePowerStatusChangeListener(listener: (event: PowerStatusChangeEvent) => void): void {
    this.listeners.delete(listener);
    if (this.listeners.size === 0) {
      this.subscription?.remove();
      this.subscription = null;
    }
  }
}

export const deviceAdapter = new DeviceAdapter();
