import {nativeAppControl, nativeLogger} from '../turbomodules'

/**
 * 设计意图：
 * Assembly 是 React 内容与 Android 宿主启动编排之间的边界层。
 * 当首屏 React 内容已经稳定可渲染时，必须显式通知原生：
 * 1. 关闭主屏启动遮罩；
 * 2. 让 StartupCoordinator 继续副屏拉起等后续动作。
 *
 * 这不是 retail-shell 或 ui-runtime 的职责，所以收敛在 assembly application。
 */
export const reportAppLoadComplete = async (displayIndex: number): Promise<void> => {
    nativeLogger.log(
        'assembly.android.mixc-retail-rn84.boot',
        JSON.stringify({
            stage: 'app-load-complete:start',
            displayIndex,
        }),
    )

    await nativeAppControl.hideLoading(displayIndex)

    nativeLogger.log(
        'assembly.android.mixc-retail-rn84.boot',
        JSON.stringify({
            stage: 'app-load-complete:done',
            displayIndex,
        }),
    )
}
