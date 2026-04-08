import {DefinedSystemParameter} from '@impos2/kernel-core-base'

export const kernelCoreTcpClientParameters = {
  credentialRefreshLeadTimeMs: new DefinedSystemParameter<number>(
    'credentialRefreshLeadTimeMs',
    'credentialRefreshLeadTimeMs',
    60_000,
  ),
}
