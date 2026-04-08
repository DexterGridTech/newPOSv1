import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from '@impos2/kernel-core-base'

export const kernelCoreTcpClientErrorMessages = {
  tcpActivationCodeInvalid: new DefinedErrorMessage(
    ErrorCategory.AUTHORIZATION,
    ErrorSeverity.HIGH,
    'tcpActivationCodeInvalid',
    'tcpActivationCodeInvalid',
    '终端激活码无效',
  ),
  tcpActivationFailed: new DefinedErrorMessage(
    ErrorCategory.NETWORK,
    ErrorSeverity.HIGH,
    'tcpActivationFailed',
    'tcpActivationFailed',
    '终端激活失败:${error}',
  ),
  tcpCredentialMissing: new DefinedErrorMessage(
    ErrorCategory.AUTHORIZATION,
    ErrorSeverity.HIGH,
    'tcpCredentialMissing',
    'tcpCredentialMissing',
    '终端凭证不存在',
  ),
  tcpCredentialExpired: new DefinedErrorMessage(
    ErrorCategory.AUTHORIZATION,
    ErrorSeverity.HIGH,
    'tcpCredentialExpired',
    'tcpCredentialExpired',
    '终端访问凭证已过期',
  ),
  tcpRefreshFailed: new DefinedErrorMessage(
    ErrorCategory.NETWORK,
    ErrorSeverity.HIGH,
    'tcpRefreshFailed',
    'tcpRefreshFailed',
    '终端凭证刷新失败:${error}',
  ),
  tcpTaskResultReportFailed: new DefinedErrorMessage(
    ErrorCategory.NETWORK,
    ErrorSeverity.MEDIUM,
    'tcpTaskResultReportFailed',
    'tcpTaskResultReportFailed',
    '终端任务结果回报失败:${error}',
  ),
  tcpBootstrapHydrationFailed: new DefinedErrorMessage(
    ErrorCategory.SYSTEM,
    ErrorSeverity.MEDIUM,
    'tcpBootstrapHydrationFailed',
    'tcpBootstrapHydrationFailed',
    '终端控制面初始化失败:${error}',
  ),
}
