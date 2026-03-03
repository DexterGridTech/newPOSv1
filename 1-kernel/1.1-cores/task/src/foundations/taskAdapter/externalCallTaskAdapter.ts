import { Observable } from 'rxjs'
import { externalConnector, ChannelDescriptor, ConnectorCode, LOG_TAGS, logger } from '@impos2/kernel-core-base'
import { TaskAdapter, TaskExecutionContext, TaskType } from '../../types'
import {moduleName} from "../../moduleName";

const TAG = [moduleName, LOG_TAGS.Task, 'ExternalCallTaskAdapter']

export interface ExternalCallTaskArgs {
    channel: ChannelDescriptor
    action: string
    params?: Record<string, any>
    timeout?: number
}

export class ExternalCallTaskAdapter implements TaskAdapter {
    readonly type: TaskType = 'externalCall'

    execute(args: ExternalCallTaskArgs, context: TaskExecutionContext): Observable<any> {
        return new Observable(subscriber => {
            const { channel, action, params, timeout } = args
            const t0 = Date.now()
            logger.log(TAG, `execute start: ${action} channel=${JSON.stringify(channel)}`)

            // 先注册 cancel，再发起调用，避免极小窗口期内 cancel 丢失
            const cancelSub = context.cancel$.subscribe(() => {
                cancelSub.unsubscribe()
                // 注意：cancel 仅终止结果推送，不中止底层硬件/网络调用
                if (!subscriber.closed) subscriber.complete()
            })

            externalConnector.call(channel, action, params, timeout)
                .then(res => {
                    if (!subscriber.closed) {
                        logger.log(TAG, `execute done: ${action} +${Date.now() - t0}ms`)
                        subscriber.next(res)
                        subscriber.complete()
                    }
                })
                .catch(err => {
                    if (!subscriber.closed) {
                        logger.log(TAG, `execute error: ${action} +${Date.now() - t0}ms ${err?.message ?? err}`)
                        subscriber.next({
                            success: false,
                            code: ConnectorCode.UNKNOWN,
                            message: err?.message ?? String(err),
                            duration: 0,
                            timestamp: Date.now(),
                        })
                        subscriber.complete()
                    }
                })

            return () => cancelSub.unsubscribe()
        })
    }
}
