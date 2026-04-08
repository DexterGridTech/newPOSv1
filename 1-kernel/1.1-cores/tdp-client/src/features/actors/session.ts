import {
  Actor,
  AppError,
  LOG_TAGS,
  logger,
  storeEntry,
} from '@impos2/kernel-core-base'
import {
  createBasicSocketRuntimeAdapter,
  getCommunicationServersFromStoreEntry,
  registerSocketRuntimeAdapter,
  type SocketLike,
} from '@impos2/kernel-core-communication'
import WebSocket from 'ws'
import {moduleName} from '../../moduleName'
import {kernelCoreTdpClientCommands} from '../commands'
import {
  createTdpSocketService,
  tdpHandshakeCoordinator,
  tdpSessionRepository,
} from '../../foundations'
import {kernelCoreTdpClientErrorMessages} from '../../supports'
import {selectTcpAccessToken, selectTcpTerminalId} from '@impos2/kernel-core-tcp-client'
import {selectTdpSessionState} from '../../selectors'
import {
  tdpControlSignalsActions,
  tdpSessionActions,
} from '../slices'
import type {TdpServerMessage} from '../../types'

// Node 环境下把 ws 包适配到 communication 所要求的 SocketLike 形状。
class NodeWsAdapter implements SocketLike {
  constructor(private readonly socket: WebSocket) {}

  send(data: string): void {
    this.socket.send(data)
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason)
  }

  addEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    if (event === 'open') {
      this.socket.on('open', () => listener())
      return
    }
    if (event === 'close') {
      this.socket.on('close', (_code, reason) => listener({reason: reason.toString()}))
      return
    }
    if (event === 'error') {
      this.socket.on('error', error => listener(error))
      return
    }
    this.socket.on('message', data => listener({data: data.toString()}))
  }

  removeEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.socket.off(event as any, listener)
  }
}

const ensureNodeSocketRuntimeAdapter = () => {
  registerSocketRuntimeAdapter(
    createBasicSocketRuntimeAdapter({
      runtimeName: 'node',
      socketCreator: (url: string) => new NodeWsAdapter(new WebSocket(url)),
    }),
  )
}

export class SessionActor extends Actor {
  private socketService?: ReturnType<typeof createTdpSocketService>

  private getSocketService() {
    if (this.socketService) {
      return this.socketService
    }
    ensureNodeSocketRuntimeAdapter()
    // 懒初始化非常关键:
    // actor 在模块注册阶段就会被实例化，而 serverSpace 直到 generateStore 中才会写入 storeEntry。
    const service = createTdpSocketService({
      serverConfigProvider: getCommunicationServersFromStoreEntry,
      socketFactory: {
        create(url: string, headers?: Record<string, string>) {
          return new NodeWsAdapter(new WebSocket(url, {headers}))
        },
      },
    })
    // 把 socket runtime 事件翻译成内部 command，后续统一走 actor/command 链处理。
    service.onEvent(event => {
      if (event.type === 'CONNECTED') {
        kernelCoreTdpClientCommands.tdpSocketConnected(undefined).executeInternally()
        return
      }
      if (event.type === 'RECONNECTING') {
        kernelCoreTdpClientCommands.tdpSocketReconnecting({attempt: event.attempt}).executeInternally()
        return
      }
      if (event.type === 'DISCONNECTED') {
        kernelCoreTdpClientCommands.tdpSocketDisconnected({reason: event.reason}).executeInternally()
        return
      }
      if (event.type === 'ERROR') {
        kernelCoreTdpClientCommands.tdpSocketErrored({error: event.error}).executeInternally()
        return
      }
      if (event.type === 'HEARTBEAT_TIMEOUT') {
        kernelCoreTdpClientCommands.tdpSocketHeartbeatTimedOut(undefined).executeInternally()
        return
      }
      if (event.type === 'MESSAGE') {
        kernelCoreTdpClientCommands.tdpMessageReceived(event.message as TdpServerMessage).executeInternally()
      }
    })
    this.socketService = service
    return service
  }

  connectTdpSession = Actor.defineCommandHandler(kernelCoreTdpClientCommands.connectTdpSession, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'SessionActor'], 'Connecting tdp session...')
    const state = storeEntry.getState()
    // TDP 不重复维护 terminalId/token 的真相源，统一依赖 tcp-client。
    const terminalId = selectTcpTerminalId(state)
    const accessToken = selectTcpAccessToken(state)
    if (!terminalId || !accessToken) {
      throw new AppError(kernelCoreTdpClientErrorMessages.tdpCredentialMissing, undefined, command)
    }

    storeEntry.dispatchAction(tdpSessionActions.setStatus('CONNECTING'))
    storeEntry.dispatchAction(tdpSessionActions.setReconnectAttempt(undefined))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastProtocolError(null))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastDisconnectReason(null))

    await this.getSocketService().connect({
      terminalId,
      token: accessToken,
    })
    return {terminalId}
  })

  tdpSocketConnected = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpSocketConnected, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'SessionActor'], 'Socket connected, sending handshake...')
    const state = storeEntry.getState()
    const terminalId = selectTcpTerminalId(state)
    if (!terminalId) {
      throw new AppError(kernelCoreTdpClientErrorMessages.tdpCredentialMissing, undefined, command)
    }

    storeEntry.dispatchAction(tdpSessionActions.setStatus('HANDSHAKING'))
    // 连接建立后立刻发送 HANDSHAKE，把 lastCursor 带给服务端决定全量还是增量同步。
    this.getSocketService().send(
      tdpHandshakeCoordinator.createHandshake({
        terminalId,
        appVersion: 'kernel-core-tdp-client-dev',
        lastCursor: tdpSessionRepository.getLastCursor(),
      }),
    )
    return {}
  })

  tdpSocketReconnecting = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpSocketReconnecting, async command => {
    storeEntry.dispatchAction(tdpSessionActions.setStatus('RECONNECTING'))
    storeEntry.dispatchAction(tdpSessionActions.setReconnectAttempt(command.payload.attempt))
    return {attempt: command.payload.attempt}
  })

  disconnectTdpSession = Actor.defineCommandHandler(kernelCoreTdpClientCommands.disconnectTdpSession, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'SessionActor'], 'Disconnecting tdp session...')
    const reason = 'disconnect by command'
    this.getSocketService().disconnect(reason)
    storeEntry.dispatchAction(tdpSessionActions.setStatus('DISCONNECTED'))
    storeEntry.dispatchAction(tdpSessionActions.setReconnectAttempt(undefined))
    storeEntry.dispatchAction(tdpSessionActions.setDisconnectReason(reason))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastDisconnectReason(reason))
    return {}
  })

  tdpSocketDisconnected = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpSocketDisconnected, async command => {
    const reason = command.payload.reason ?? null
    const sessionState = selectTdpSessionState(storeEntry.getState())
    const isReconnecting = sessionState.status?.value === 'RECONNECTING'
    storeEntry.dispatchAction(tdpSessionActions.setStatus(isReconnecting ? 'RECONNECTING' : 'DISCONNECTED'))
    storeEntry.dispatchAction(tdpSessionActions.setDisconnectReason(reason))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastDisconnectReason(reason))
    return {reason}
  })

  tdpSocketHeartbeatTimedOut = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpSocketHeartbeatTimedOut, async () => {
    storeEntry.dispatchAction(tdpSessionActions.setStatus('RECONNECTING'))
    storeEntry.dispatchAction(tdpSessionActions.setDisconnectReason('heartbeat timeout'))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastDisconnectReason('heartbeat timeout'))
    return {reason: 'heartbeat timeout'}
  })

  tdpSocketErrored = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpSocketErrored, async command => {
    storeEntry.dispatchAction(tdpSessionActions.setStatus('ERROR'))
    const appError = new AppError(
      kernelCoreTdpClientErrorMessages.tdpProtocolError,
      {error: command.payload.error instanceof Error ? command.payload.error.message : String(command.payload.error)},
      command,
    )
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastProtocolError(appError))
    kernelCoreTdpClientCommands.tdpProtocolFailed({error: appError}).executeFromParent(command)
    return {}
  })

  sendPing = Actor.defineCommandHandler(kernelCoreTdpClientCommands.sendPing, async () => {
    this.getSocketService().send({type: 'PING'})
    return {}
  })

  acknowledgeCursor = Actor.defineCommandHandler(kernelCoreTdpClientCommands.acknowledgeCursor, async command => {
    // ACK 确认的是增量 cursor，同时借 topic/itemKey/instanceId 回写业务投递状态。
    this.getSocketService().send({
      type: 'ACK',
      data: command.payload,
    })
    return {cursor: command.payload.cursor}
  })

  reportAppliedCursor = Actor.defineCommandHandler(kernelCoreTdpClientCommands.reportAppliedCursor, async command => {
    // STATE_REPORT 用于告诉服务端“客户端本地已经真正应用到了哪个 cursor”。
    this.getSocketService().send({
      type: 'STATE_REPORT',
      data: {
        lastAppliedCursor: command.payload.cursor,
        connectionMetrics: command.payload.connectionMetrics,
        localStoreMetrics: command.payload.localStoreMetrics,
      },
    })
    return {cursor: command.payload.cursor}
  })
}
