import {Actor, kernelCoreBaseCommands, LOG_TAGS, logger} from '@impos2/kernel-core-base';

import {moduleName} from '../../moduleName';

export class InitializeActor extends Actor {
  initialize = Actor.defineCommandHandler(
    kernelCoreBaseCommands.initialize,
    async (): Promise<Record<string, never>> => {
      logger.log(
        [moduleName, LOG_TAGS.Actor, 'InitializeActor'],
        'Initializing Assembly electron desktop...',
      );
      return {};
    },
  );
}
