import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveTopologyHostDeviceId } from './setup-android-port-forwarding.mjs';

test('resolveTopologyHostDeviceId prefers explicit serial when --topology-host is enabled', () => {
  const devices = [
    { id: 'usb-device' },
    { id: 'emulator-5554' },
    { id: 'emulator-5556' },
  ];

  assert.equal(
    resolveTopologyHostDeviceId(devices, 'emulator-5554', true),
    'emulator-5554',
  );
});

test('resolveTopologyHostDeviceId falls back to first device when explicit serial is absent', () => {
  const devices = [
    { id: 'emulator-5554' },
    { id: 'emulator-5556' },
  ];

  assert.equal(
    resolveTopologyHostDeviceId(devices, '', true),
    'emulator-5554',
  );
});

test('resolveTopologyHostDeviceId honors auto-primary when topology flag is disabled', () => {
  const devices = [
    { id: 'emulator-5554' },
    { id: 'emulator-5556' },
  ];

  assert.equal(
    resolveTopologyHostDeviceId(devices, 'auto-primary', false),
    'emulator-5554',
  );
});
