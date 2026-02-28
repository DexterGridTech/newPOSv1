import { Observable } from 'rxjs'
import { externalConnector, ConnectorEvent, LOG_TAGS, logger } from '@impos2/kernel-core-base'
import { TaskAdapter, TaskExecutionContext, TaskType } from '../../types'
import {moduleName} from "../../moduleName";

const TAG = [moduleName, LOG_TAGS.Task, 'ExternalOnTaskAdapter']

export interface ExternalOnTaskArgs {
    eventType: string
    /** 可选，按 target 过滤事件，留空接收全部 */
    targetFilter?: string | string[]
}

export class ExternalOnTaskAdapter implements TaskAdapter {
    readonly type: TaskType = 'externalOn'

    execute(args: ExternalOnTaskArgs, context: TaskExecutionContext): Observable<any> {
        return new Observable(subscriber => {
            const { eventType, targetFilter } = args
            const t0 = Date.now()
            logger.log(TAG, `execute start: eventType=${eventType}`)

            // 幂等保护，防止 cancelSub 回调和 teardown 双重调用
            let removed = false
            const safeRemove = () => {
                if (removed) return
                removed = true
                removeListener()
            }

            const removeListener = externalConnector.on(eventType, (event: ConnectorEvent) => {
                if (targetFilter) {
                    const filters = Array.isArray(targetFilter) ? targetFilter : [targetFilter]
                    if (!filters.includes(event.target)) return
                }
                logger.log(TAG, `event received: eventType=${eventType} +${Date.now() - t0}ms`)
                if (!subscriber.closed) subscriber.next(event)
            })
            logger.log(TAG, `listener registered: eventType=${eventType}`)

            const cancelSub = context.cancel$.subscribe(() => {
                safeRemove()
                cancelSub.unsubscribe()
                if (!subscriber.closed) subscriber.complete()
            })

            return () => {
                safeRemove()
                cancelSub.unsubscribe()
            }
        })
    }
}
