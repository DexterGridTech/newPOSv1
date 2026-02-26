import { Observable } from 'rxjs'
import { externalConnector } from '@impos2/kernel-core-base'
import { ChannelDescriptor, ConnectorEvent } from '@impos2/kernel-core-base'
import { TaskAdapter, TaskExecutionContext, TaskType } from '../../types'

interface ExternalCallTaskArgs {
    channel: ChannelDescriptor
    action?: string
    params?: Record<string, any>
    timeout?: number
}

export class ExternalCallTaskAdapter implements TaskAdapter {
    readonly type: TaskType = 'externalCall'

    execute(args: ExternalCallTaskArgs, context: TaskExecutionContext): Observable<any> {
        return new Observable(subscriber => {
            const { channel, action = '', params, timeout } = args

            if (channel.mode === 'request-response') {
                externalConnector.call(channel, action, params, timeout)
                    .then(res => {
                        subscriber.next(res)
                        subscriber.complete()
                    })
                    .catch(err => {
                        subscriber.next({
                            success: false,
                            code: 9999,
                            message: err?.message ?? String(err),
                            duration: 0,
                            timestamp: Date.now(),
                        })
                        subscriber.complete()
                    })

            } else if (channel.mode === 'stream') {
                let channelId = ''
                let cancelled = false

                const onEvent = (event: ConnectorEvent) => {
                    if (!subscriber.closed) subscriber.next(event)
                }
                const onError = (error: ConnectorEvent) => {
                    if (!subscriber.closed) subscriber.next({ success: false, ...error })
                }

                const cancelSub = context.cancel$.subscribe(() => {
                    cancelled = true
                    if (channelId) externalConnector.unsubscribe(channelId)
                    cancelSub.unsubscribe()
                    if (!subscriber.closed) subscriber.complete()
                })

                externalConnector.subscribe(channel, onEvent, onError)
                    .then(id => {
                        if (!id) {
                            // subscribe 返回空说明 connector 未注册，直接结束
                            cancelSub.unsubscribe()
                            if (!subscriber.closed) {
                                subscriber.next({ success: false, code: 9999, message: 'ExternalConnector not registered', duration: 0, timestamp: Date.now() })
                                subscriber.complete()
                            }
                            return
                        }
                        channelId = id
                        // 若在 subscribe 完成前已取消，立即清理
                        if (cancelled) externalConnector.unsubscribe(id)
                    })
                    .catch(err => {
                        cancelSub.unsubscribe()
                        if (!subscriber.closed) {
                            subscriber.next({ success: false, code: 9999, message: err?.message ?? String(err), duration: 0, timestamp: Date.now() })
                            subscriber.complete()
                        }
                    })

                return () => {
                    cancelled = true
                    if (channelId) externalConnector.unsubscribe(channelId)
                    cancelSub.unsubscribe()
                }

            } else if (channel.mode === 'passive') {
                // passive 模式：监听 Kotlin 层通过 BroadcastReceiver 推送的被动事件
                const removeListener = externalConnector.on('connector.passive', (event: ConnectorEvent) => {
                    // 按 target 过滤，只处理与本通道匹配的事件
                    if (channel.target && event.target !== channel.target) return
                    subscriber.next(event)
                })

                const cancelSub = context.cancel$.subscribe(() => {
                    removeListener()
                    cancelSub.unsubscribe()
                    subscriber.complete()
                })

                return () => {
                    removeListener()
                    cancelSub.unsubscribe()
                }
            }
        })
    }
}
