import type {AppModule} from '@impos2/kernel-core-base';
import {uiIntegrationMixcRetailModule} from '@impos2/ui-integration-mixc-retail';

import {assemblyElectronMixcRetailActors} from './features/actors';
import {assemblyElectronMixcRetailCommands} from './features/commands';
import {assemblyElectronMixcRetailEpics} from './features/epics';
import {assemblyElectronMixcRetailMiddlewares} from './features/middlewares';
import {assemblyElectronMixcRetailSlice} from './features/slices';
import {moduleName} from './moduleName';
import {assemblyElectronMixcRetailErrorMessages} from './supports/errors';
import {assemblyElectronMixcRetailParameters} from './supports/parameters';
import {assemblyElectronMixcRetailScreenParts} from './ui';
import {releaseInfo} from './generated/releaseInfo';

export const assemblyElectronMixcRetailModule: AppModule = {
  name: moduleName,
  version: releaseInfo.assemblyVersion,
  slices: assemblyElectronMixcRetailSlice,
  middlewares: assemblyElectronMixcRetailMiddlewares,
  epics: assemblyElectronMixcRetailEpics,
  commands: assemblyElectronMixcRetailCommands,
  actors: assemblyElectronMixcRetailActors,
  errorMessages: assemblyElectronMixcRetailErrorMessages,
  parameters: assemblyElectronMixcRetailParameters,
  dependencies: [uiIntegrationMixcRetailModule],
  screenParts: assemblyElectronMixcRetailScreenParts,
};

export * from './application/modulePreSetup';
export * from './features/commands';
export * from './foundations';
export * from './hooks';
export * from './moduleName';
export * from './store';
export * from './supports';
export * from './types';
export * from './ui';
