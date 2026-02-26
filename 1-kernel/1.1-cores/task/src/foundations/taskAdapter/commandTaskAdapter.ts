import {Observable} from 'rxjs';
import {getCommandByName, shortId, storeEntry} from '@impos2/kernel-core-base';
import {selectMergedRequestStatus, CommandRequestStatus} from '@impos2/kernel-core-interconnection';
import {RootState} from '@impos2/kernel-core-base';
import {TaskAdapter, TaskExecutionContext, TaskType} from '../../types';

interface CommandTaskArgs {
    commandName: string;
    payload: any;
    extra?: Record<string, any>;
    sessionId?: string;
}

export class CommandTaskAdapter implements TaskAdapter {
    readonly type: TaskType = 'command';

    execute(args: CommandTaskArgs, context: TaskExecutionContext): Observable<CommandRequestStatus> {
        return new Observable<CommandRequestStatus>(subscriber => {
            const {commandName, payload, extra = {}, sessionId} = args;

            // 实例化 command，id 由 Command 构造函数中的 shortId() 自动赋值
            let command;
            try {
                command = getCommandByName(commandName, payload);
            } catch (e: any) {
                subscriber.next({
                    status: 'error',
                    errors: [{ code: 'COMMAND_NOT_FOUND', message: e?.message ?? String(e), retryable: false }]
                } as unknown as CommandRequestStatus);
                subscriber.complete();
                return;
            }

            const commandRequestId = shortId();
            command.withExtra(extra).execute(commandRequestId, sessionId);

            const store = storeEntry.getStore();
            if (!store) {
                subscriber.next({
                    status: 'error',
                    errors: [{ code: 'STORE_NOT_INITIALIZED', message: 'Store not initialized', retryable: false }]
                } as unknown as CommandRequestStatus);
                subscriber.complete();
                return;
            }

            // 用 store.subscribe 监听 requestStatus 变化
            let prev: CommandRequestStatus | null = null;
            const unsubscribe = store.subscribe(() => {
                const next = selectMergedRequestStatus(store.getState() as RootState, commandRequestId);
                if (!next || next === prev) return;
                prev = next;
                subscriber.next(next);
                if (next.status === 'complete' || next.status === 'error') {
                    unsubscribe();
                    subscriber.complete();
                }
            });

            // 取消信号
            const cancelSub = context.cancel$.subscribe(() => {
                unsubscribe();
                cancelSub.unsubscribe();
                subscriber.complete();
            });

            return () => {
                unsubscribe();
                cancelSub.unsubscribe();
            };
        });
    }
}
