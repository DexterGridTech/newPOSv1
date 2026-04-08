import {Actor, LOG_TAGS, logger, storeEntry} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {kernelCoreTcpClientCommands} from '../commands'
import {tcpRuntimeActions} from '../slices'

export class BootstrapActor extends Actor {
  bootstrapTcpClient = Actor.defineCommandHandler(kernelCoreTcpClientCommands.bootstrapTcpClient, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'BootstrapActor'], 'Bootstrapping tcp client...')
    // bootstrapped 只表示“本次进程已经完成初始化”，
    // 不应污染真正业务命令的 requestId 观测字段。
    storeEntry.dispatchAction(tcpRuntimeActions.setBootstrapped(true))
    kernelCoreTcpClientCommands.bootstrapTcpClientSucceeded(undefined).executeFromParent(command)
    return {}
  })
}
