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
            logger.log(TAG, `[${context.requestId}] execute start: ${action}`)

            const cancelSub = context.cancel$.subscribe(() => {
                logger.log(TAG, `[${context.requestId}] cancel$ triggered, subscriber.closed=${subscriber.closed}`)
                cancelSub.unsubscribe()
                if (!subscriber.closed) {
                    logger.log(TAG, `[${context.requestId}] calling subscriber.complete()`)
                    subscriber.complete()
                }
            })

            externalConnector.call(channel, action, params, timeout)
                .then(res => {
                    logger.log(TAG, `[${context.requestId}] Promise resolved, subscriber.closed=${subscriber.closed}, result=${JSON.stringify(res)}`)
                    cancelSub.unsubscribe()
                    if (!subscriber.closed) {
                        logger.log(TAG, `[${context.requestId}] calling subscriber.next() and complete()`)
                        subscriber.next(res)
                        subscriber.complete()
                    } else {
                        logger.log(TAG, `[${context.requestId}] subscriber already closed, ignoring result`)
                    }
                })
                .catch(err => {
                    logger.log(TAG, `[${context.requestId}] Promise rejected, subscriber.closed=${subscriber.closed}, error=${err?.message ?? err}`)
                    cancelSub.unsubscribe()
                    if (!subscriber.closed) {
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

            return () => {
                logger.log(TAG, `[${context.requestId}] teardown called`)
                cancelSub.unsubscribe()
            }
        })
    }
}
