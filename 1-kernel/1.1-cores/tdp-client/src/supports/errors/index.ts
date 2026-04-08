import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from '@impos2/kernel-core-base'

export const kernelCoreTdpClientErrorMessages = {
  tdpCredentialMissing: new DefinedErrorMessage(
    ErrorCategory.AUTHORIZATION,
    ErrorSeverity.HIGH,
    'tdpCredentialMissing',
    'tdpCredentialMissing',
    'TDP 连接缺少终端凭证',
  ),
  tdpHandshakeFailed: new DefinedErrorMessage(
    ErrorCategory.NETWORK,
    ErrorSeverity.HIGH,
    'tdpHandshakeFailed',
    'tdpHandshakeFailed',
    'TDP 握手失败:${error}',
  ),
  tdpProtocolError: new DefinedErrorMessage(
    ErrorCategory.SYSTEM,
    ErrorSeverity.HIGH,
    'tdpProtocolError',
    'tdpProtocolError',
    'TDP 协议错误:${error}',
  ),
}
