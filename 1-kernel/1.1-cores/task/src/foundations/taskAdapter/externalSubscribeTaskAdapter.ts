import { Observable } from 'rxjs'
import { externalConnector, ChannelDescriptor, ConnectorEvent, ConnectorCode, LOG_TAGS, logger } from '@impos2/kernel-core-base'
import { TaskAdapter, TaskExecutionContext, TaskType } from '../../types'
import {moduleName} from "../../moduleName";

const TAG = [moduleName, LOG_TAGS.Task, 'ExternalSubscribeTaskAdapter']

export interface ExternalSubscribeTaskArgs {
    channel: ChannelDescriptor
}

export class ExternalSubscribeTaskAdapter implements TaskAdapter {
    readonly type: TaskType = 'externalSubscribe'

    execute(args: ExternalSubscribeTaskArgs, context: TaskExecutionContext): Observable<any> {
        return new Observable(subscriber => {
            const { channel } = args
            const t0 = Date.now()
            logger.log(TAG, `execute start: channel=${JSON.stringify(channel)}`)
            let channelId = ''
            let cancelled = false

            // 幂等保护，防止 cancelSub 回调和 teardown 双重 unsubscribe
            let unsubscribed = false
            const safeUnsubscribe = () => {
                if (unsubscribed || !channelId) return
                unsubscribed = true
                externalConnector.unsubscribe(channelId)
            }

            const onEvent = (event: ConnectorEvent) => {
                if (!subscriber.closed) subscriber.next(event)
            }
            // onError 保持 ConnectorEvent 类型，下游通过 event.data === null 判断错误
            const onError = (error: ConnectorEvent) => {
                if (!subscriber.closed) subscriber.next(error)
            }

            const cancelSub = context.cancel$.subscribe(() => {
                cancelled = true
                safeUnsubscribe()
                cancelSub.unsubscribe()
                if (!subscriber.closed) subscriber.complete()
            })

            externalConnector.subscribe(channel, onEvent, onError)
                .then(id => {
                    if (!id) {
                        cancelSub.unsubscribe()
                        if (!subscriber.closed) {
                            subscriber.next({ success: false, code: ConnectorCode.NOT_REGISTERED, message: 'ExternalConnector not registered', duration: 0, timestamp: Date.now() })
                            subscriber.complete()
                        }
                        return
                    }
                    channelId = id
                    logger.log(TAG, `subscribed: channelId=${id} +${Date.now() - t0}ms`)
                    if (cancelled) safeUnsubscribe()
                })
                .catch(err => {
                    cancelSub.unsubscribe()
                    if (!subscriber.closed) {
                        subscriber.next({ success: false, code: ConnectorCode.UNKNOWN, message: err?.message ?? String(err), duration: 0, timestamp: Date.now() })
                        subscriber.complete()
                    }
                })

            return () => {
                cancelled = true
                safeUnsubscribe()
                cancelSub.unsubscribe()
            }
        })
    }
}
