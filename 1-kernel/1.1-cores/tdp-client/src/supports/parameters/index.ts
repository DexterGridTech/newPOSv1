import {DefinedSystemParameter} from '@impos2/kernel-core-base'

export const kernelCoreTdpClientParameters = {
  pingIntervalMs: new DefinedSystemParameter<number>(
    'tdpPingIntervalMs',
    'tdpPingIntervalMs',
    15_000,
  ),
}
