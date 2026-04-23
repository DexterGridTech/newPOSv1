import type {
    CreateSocketLifecycleControllerInput,
    SocketLifecycleController,
} from '../types'

export const createSocketLifecycleController = (
    input: CreateSocketLifecycleControllerInput,
): SocketLifecycleController => {
    /**
     * 设计意图：
     * Socket 生命周期控制器只处理通用连接状态和重连节奏，不理解 TDP 或 topology 协议。
     * 真实业务要求 WS 无限重连时，由上层通过 reconnect policy 表达；测试场景可以覆写 attempts 来缩短验证时间。
     */
    let listenersAttached = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempt = 0
    let manualStop = false
    let connectionToken = 0

    const clearReconnectTimer = () => {
        if (!reconnectTimer) {
            return
        }
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
    }

    const getReconnectAttempt = () => reconnectAttempt

    const resetReconnectAttempt = () => {
        reconnectAttempt = 0
    }

    const attach = () => {
        if (listenersAttached) {
            return
        }
        listenersAttached = true
        input.attachListeners({
            connected() {
                clearReconnectTimer()
                resetReconnectAttempt()
                input.onConnected?.()
            },
            disconnected(reason) {
                input.onDisconnected?.(reason)
                controller.scheduleReconnect(reason)
            },
            error(error) {
                input.onError?.(error)
                controller.scheduleReconnect(error instanceof Error ? error.message : String(error))
            },
        })
    }

    const start = async (options?: {isReconnect?: boolean}) => {
        attach()
        clearReconnectTimer()
        manualStop = false
        const token = ++connectionToken
        const isReconnect = options?.isReconnect === true
        input.onConnectStarting?.({isReconnect})
        try {
            await input.connect({isReconnect})
        } catch (error) {
            input.onConnectFailed?.({isReconnect, error})
            if (token !== connectionToken || manualStop) {
                throw error
            }
            if (input.shouldReconnectOnConnectError?.(error) === false) {
                throw error
            }
            controller.scheduleReconnect(error instanceof Error ? error.message : String(error))
            return
        }
        // token 防止“旧 connect 慢返回”覆盖新的 stop/restart 决策，避免重连竞态造成幽灵连接。
        if (token !== connectionToken || manualStop) {
            input.disconnect('stale-connect')
            return
        }
        await input.onConnectResolved?.({isReconnect})
    }

    const stop = (reason?: string) => {
        manualStop = true
        connectionToken += 1
        resetReconnectAttempt()
        clearReconnectTimer()
        input.disconnect(reason)
    }

    const restart = async (reason?: string) => {
        stop(reason)
        await start()
    }

    const scheduleReconnect = (reason?: string) => {
        if (manualStop || reconnectTimer || !input.shouldReconnect()) {
            return
        }

        const policy = input.resolveReconnectPolicy()
        if (policy.attempts >= 0 && reconnectAttempt >= policy.attempts) {
            input.onReconnectGiveUp?.({
                reason,
                attempt: reconnectAttempt,
                attempts: policy.attempts,
            })
            return
        }

        reconnectAttempt += 1
        input.onReconnectScheduled?.({
            reason,
            attempt: reconnectAttempt,
            delayMs: policy.delayMs,
        })
        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined
            void start({isReconnect: true}).catch(error => {
                scheduleReconnect(error instanceof Error ? error.message : String(error))
            })
        }, policy.delayMs)
    }

    const controller: SocketLifecycleController = {
        attach,
        start,
        stop,
        restart,
        getReconnectAttempt,
        resetReconnectAttempt,
        clearReconnectTimer,
        scheduleReconnect,
    }

    return controller
}
