import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands,
    kernelCoreBaseState,
    ScreenMode, ServerSpace, shortId,
    // @ts-ignore
} from "@impos2/kernel-core-base";
import {kernelCoreTaskModule, TaskSystem} from "../src";
import {tap} from "rxjs/operators";
import {testTaskDefinition1} from "./testTaskDefinition";

export const dev: ServerSpace = {
    selectedSpace: 'dev',
    spaces: [
        {
            name: 'dev',
            serverAddresses: []
        }
    ]
}
const appConfig: ApplicationConfig = {
    serverSpace: dev,
    environment: {
        deviceId: "123",
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 1,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: kernelCoreTaskModule
}

async function initializeApp() {
    const {store} = await ApplicationManager.getInstance().generateStore(appConfig)

    setTimeout(() => {
        console.log('===================')

        const requestId = shortId()
        const taskSystem = TaskSystem.getInstance()
        taskSystem.registerTask(testTaskDefinition1)
        const task$ = taskSystem.task("open_take_close").run(requestId, {
            key: "secret key",
            bagId: 'bag1'
        }, false)

        const subscription = task$.pipe(
            // tap((progress) => console.log('progress:', progress))
        ).subscribe({
            next: (progress) => {
                const ctx = progress.context

                // open 节点错误 → 任务失败
                if (progress.type === 'NODE_ERROR' && progress.nodeKey === 'open') {
                    console.log('❌ 任务失败：key is not right')
                    subscription.unsubscribe()
                    taskSystem.cancel(requestId)
                    return
                }

                // close 节点完成 → 检查最终结果
                if (progress.type === 'NODE_COMPLETE' && progress.nodeKey === 'close') {
                    const bagId = progress.context?.bagId as string | undefined
                    const bagFull = bagId && progress.context?.take?.[bagId] === 'full}'
                    const doorClosed = (progress.payload as any)?.door === 'closed'
                    if (bagFull && doorClosed) {
                        console.log('✅ 任务完成：bag is full && door is closed')
                        subscription.unsubscribe()
                        taskSystem.cancel(requestId)
                    }
                }
            },
            complete: () => {
                console.log('stream complete')
            }
        })

    }, 2000)
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})