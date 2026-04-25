# 3-adapter/android

`3-adapter/android` 是 Android 适配层。它把 Android/RN 原生能力、安全存储、日志、设备信息、连接器、拓扑 host、热更新、automation socket 等平台事实暴露为稳定端口，并提供可复用的 RN84 host runtime。

当前主要包：

| 包 | 定位 |
| --- | --- |
| `adapter-android-v2` | Android 原生 adapter library 与 dev-app，提供设备、日志、连接器、脚本、拓扑 host 等底层能力。 |
| `host-runtime-rn84` | 可复用 RN84 host runtime，组合 base kernel/UI modules、platform ports、native wrappers、automation、hot-update。 |

## 目录定位

```text
Android platform facts -> 3-adapter/android -> 4-assembly/android
                                      -> 1-kernel platform-ports
                                      -> 2-ui automation/admin bridges
```

adapter 只提供平台能力和 host 运行环境，不承载业务包依赖，不做产品业务决策。

## 可以放什么

- Kotlin/Java Android adapter 实现。
- TurboModule / NativeModule bridge。
- Android state storage、secure storage、logger、device info、connector、script executor。
- topology host native service。
- hot-update native download/install/boot marker。
- RN84 reusable host runtime。
- Android automation socket debug host。
- adapter/host runtime 单元测试、Gradle 测试、dev-app。

## 不应该放什么

- `1-kernel/1.2-business` 业务依赖。
- `2-ui/2.2-business` 业务 UI 依赖。
- 产品 assembly 专属业务流程。
- 具体商场/餐饮业务数据映射。
- 业务 screen 选择策略。

## host-runtime-rn84 边界

`host-runtime-rn84` 是“可复用宿主”，不是产品业务 shell。它可以依赖：

- `1-kernel/1.1-base/*`
- `1-kernel/server-config-v2`
- `2-ui/2.1-base/*`
- `3-adapter/android/adapter-android-v2`

它不得依赖：

- `1-kernel/1.2-business/*`
- `2-ui/2.2-business/*`
- `2-ui/2.3-integration/*` 中具体业务 shell

产品业务由 `4-assembly/android/*` 注入 integration shell。

## Android automation 调试规范

真实终端调试优先使用：

```bash
node scripts/android-automation-rpc.mjs hello --serial <device> --target primary --host-port <host> --device-port 18584 --no-start
node scripts/android-automation-rpc.mjs call runtime.getInfo --serial <device> --target primary --host-port <host> --device-port 18584 --params '{"target":"primary"}' --no-start
node scripts/android-automation-rpc.mjs call runtime.getState --serial <device> --target primary --host-port <host> --device-port 18584 --params '{"target":"primary"}' --no-start
```

双设备单屏时，两个 emulator 可能都只有 `primary` target / `18584`；不要误判 `18585` 必须在线。单机双屏 managed secondary 才会暴露副屏进程/副屏 socket。

## 新增 Android 能力注意事项

1. 先定义 platform port 或 host interface，再实现 native adapter。
2. adapter 返回平台事实，不做业务解释。
3. 需要业务确认的操作只提供能力，不直接弹业务 UI。
4. 所有 native 关键路径必须有日志。
5. 涉及重启、热更新、拓扑、存储的能力必须覆盖恢复/失败路径。
6. 不要把临时调试脚本变成业务依赖。

## 验证建议

```bash
corepack yarn workspace @next/adapter-android-v2 build:android
corepack yarn workspace @next/host-runtime-rn84 type-check
cd 4-assembly/android/mixc-catering-assembly-rn84/android && ./gradlew :app:assembleDebug
```

涉及运行时行为时，必须结合 emulator、automation socket、JS/native logcat 复验。
