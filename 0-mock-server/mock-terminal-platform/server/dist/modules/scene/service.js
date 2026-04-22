import { batchCreateTerminals, createTaskRelease, createTaskInstancesForRelease } from '../tcp/service.js';
import { dispatchTaskReleaseToDataPlane } from '../tdp/service.js';
export const listSceneTemplates = () => [
    {
        sceneTemplateId: 'scene-batch-terminal-online',
        name: '门店批量上线',
        description: '批量创建终端并发布配置下发任务',
        category: 'terminal-bootstrap',
        steps: ['create terminals', 'release config task', 'dispatch to tdp'],
    },
    {
        sceneTemplateId: 'scene-upgrade-gray',
        name: '灰度升级演练',
        description: '创建升级发布单并按指定终端分批投递',
        category: 'upgrade',
        steps: ['select terminals', 'create upgrade release', 'observe delivery'],
    },
];
export const runSceneTemplate = (sceneTemplateId, input = {}) => {
    const sandboxId = input.sandboxId;
    if (!sandboxId) {
        throw new Error('SANDBOX_ID_REQUIRED');
    }
    if (sceneTemplateId === 'scene-batch-terminal-online') {
        const terminals = batchCreateTerminals(sandboxId, input.batchCount ?? 5);
        const targetTerminalIds = input.targetTerminalIds?.length
            ? input.targetTerminalIds
            : terminals.terminalIds;
        const release = createTaskRelease({
            sandboxId,
            title: '场景-批量配置下发',
            taskType: 'CONFIG_PUBLISH',
            sourceType: 'CONFIG',
            sourceId: 'config-scene-default',
            priority: 80,
            targetTerminalIds,
            payload: { configVersion: 'config-2026.04.06', strategy: 'immediate' },
        });
        const dispatch = createTaskInstancesForRelease({ sandboxId, releaseId: release.releaseId });
        const tdp = dispatchTaskReleaseToDataPlane({ sandboxId, releaseId: release.releaseId });
        return { sceneTemplateId, terminals, release, dispatch, tdp, targetTerminalIds };
    }
    const targetTerminalIds = input.targetTerminalIds?.length
        ? input.targetTerminalIds
        : ['T-1001', 'T-1002', 'T-1003'];
    const release = createTaskRelease({
        sandboxId,
        title: '场景-灰度热更新',
        taskType: 'APP_UPGRADE',
        sourceType: 'APP_VERSION',
        sourceId: 'app-2.4.0',
        priority: 90,
        targetTerminalIds,
        payload: { targetVersion: '2.4.0', bundleVersion: 'bundle-2026.04.06.1', policy: 'gray-10%' },
    });
    const dispatch = createTaskInstancesForRelease({ sandboxId, releaseId: release.releaseId });
    const tdp = dispatchTaskReleaseToDataPlane({ sandboxId, releaseId: release.releaseId });
    return { sceneTemplateId, release, dispatch, tdp, targetTerminalIds };
};
