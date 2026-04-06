import React from 'react';
import {AppRegistry} from 'react-native';
import type {HostBridgeApi} from '@impos2/adapter-electron-v1/shared/contracts';
import {hostBridgeNamespace} from '@impos2/adapter-electron-v1/shared';
import {RootApp} from '../../src/RootApp';

declare global {
  interface Window {
    [hostBridgeNamespace]: HostBridgeApi;
  }
}

export async function bootstrapRenderer() {
  window.addEventListener('error', event => {
    console.error('window.error', event.error ?? event.message);
  });

  window.addEventListener('unhandledrejection', event => {
    console.error('window.unhandledrejection', event.reason);
  });

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Renderer root element not found');
  }

  const launchContext = await window[hostBridgeNamespace].getLaunchContext();
  console.log('bootstrapRenderer launchContext', launchContext);

  const appName = 'adapter-electron-dev-app';
  AppRegistry.registerComponent(appName, () => () => (
    <RootApp
      deviceId={launchContext.deviceId}
      screenMode={launchContext.screenMode}
      displayCount={launchContext.displayCount}
      displayIndex={launchContext.displayIndex}
    />
  ));

  AppRegistry.runApplication(appName, {
    rootTag: rootElement,
    mode: 'concurrent',
  });
}
