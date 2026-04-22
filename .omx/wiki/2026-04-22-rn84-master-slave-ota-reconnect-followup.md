---
title: "2026-04-22-rn84-master-slave-ota-reconnect-followup"
tags: ["rn84", "android", "hot-update", "ota", "topology", "master-slave", "e2e"]
created: 2026-04-22T00:00:00.000Z
updated: 2026-04-22T00:00:00.000Z
sources: ["4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts", "4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-create-app.spec.ts", "ai-result/master-slave-ota-e2e-20260422-063503"]
links: ["rn84-android-hot-update-e2e.md", "topology-aware-ui-automation-conventions.md"]
category: session-log
confidence: high
schemaVersion: 1
---

# 2026-04-22-rn84-master-slave-ota-reconnect-followup

## 目标

继续完成 RN84 两台单屏模拟器的主从拓扑 + 生产包 + OTA 热更新 E2E。目标链路：生产 APK 运行 -> A 设为 master 并开启 topology host -> B 通过扫码导入 masterInfo 成为 slave -> A 激活 -> B 设为 SECONDARY -> A 重启恢复 -> 下发 OTA -> A/B 同步更新并保持 topology 联通。之后再检查旧工程里“单机 slave 通电/断电时提示用户切换主屏/副屏”的业务是否已迁移。

## 本轮关键进展

1. 先前 run 目录是 `ai-result/master-slave-ota-e2e-20260422-063503`，其中大部分链路已经真实跑通。
2. `ota.4` 时，A/B 都已成功应用热更新，UI 都显示 `V21`，mock-terminal-platform 版本历史也正确上报 `source=hot-update`、`bundleVersion=1.0.0+ota.4`。
3. 真实残留 bug 是：B 在 OTA 重启后 topology context 仍是 `SLAVE + SECONDARY`，热更新版本也正确，但 topology connection 变成 `DISCONNECTED`，没有自动恢复连接。
4. 已在 `4-assembly/android/mixc-retail-assembly-rn84/src/application/createApp.ts` 修复：增加 standalone slave 冷启动恢复逻辑。条件是 `standalone=true && instanceMode=SLAVE`，`masterLocator` 已持久化且当前 connection 为 `DISCONNECTED` 时，assembly 在启动编排里自动 dispatch `startTopologyConnection`；并用本地 `autoStartKey` 去重，避免对同一 masterLocator 重复 dispatch。
5. 已在 `4-assembly/android/mixc-retail-assembly-rn84/test/scenarios/assembly-create-app.spec.ts` 增加回归测试，锁住“单屏 standalone slave + persisted masterLocator + disconnected 时，启动后自动连 topology 且重复 state 通知不重复 dispatch”的场景。
6. 回归测试已通过：`corepack yarn workspace @impos2/assembly-android-mixc-retail-rn84 test test/scenarios/assembly-create-app.spec.ts` 全绿；`4-assembly/android/mixc-retail-assembly-rn84` 下 `../../../node_modules/.bin/tsc --noEmit` 也已通过。
7. UI 版本标记仍保留为 `V21`：`2-ui/2.3-integration/retail-shell/src/ui/screens/WelcomeScreen.tsx` 与 `SecondaryWelcomeScreen.tsx` 已修改，用于区分 OTA 前后。
8. `release.manifest.json` 与 `src/generated/releaseInfo.ts` 已 bump 到 `bundleVersion=1.0.0+ota.5`，新的热更新包也已经成功生成：`dist/hot-updates/hot-update-assembly-android-mixc-retail-rn84-1.0.0+ota.5.zip`。

## 当前现场和注意事项

1. mock-terminal-platform 正确端口是 `5810`，不是 `9100`。`1-kernel/server-config-v2/src/dev.ts` 里也是 `127.0.0.1:5810`。
2. mock-platform 的 `/api/health` 不存在，不能拿它做健康检查；应看 server 启动日志或直接用实际 API。
3. 双机 topology relay 仍需要：host `0.0.0.0:18889 -> 127.0.0.1:18888`。A 需要 `adb forward tcp:18888 tcp:8888`；B 需要 `adb reverse tcp:18889 tcp:18889`。
4. automation socket 需要：A=`emulator-5554` forward `tcp:28554 -> 18584`，B=`emulator-5556` forward `tcp:28556 -> 18584`。
5. 两台模拟器每次冷启动前都要先 `force-stop com.impos2.mixcretailassemblyrn84`，避免残留进程污染结果。
6. 历史上已经验证成功的激活信息：`sandboxId=sandbox-kernel-base-test`，`activationCode=200000000001`，`terminalId=terminal_j0o6hvtvwjkr`。旧 `ota.4` 的 `packageId/releaseId` 是 `pkg_06p2uoa57h83 / release_7s1ng8987h8a`，仅作参考。
7. 本轮打 `ota.5` 时，先被测试 mock 类型问题拦住，后已修复；随后成功重新生成热更新包。上一次因提权命令被用户中断，造成“已生成 ota.5 包，但还没有继续 upload/release/live verify”的中间态。

## 待完成

1. 将 `ota.5` 上传到 mock-terminal-platform、创建并激活 release。
2. 在当前两台模拟器上完成真实 OTA 更新验证。
3. 验证点必须同时看：主副机 UI、state、JS/native log、mock-terminal-platform 终端版本历史。
4. 关键验收点：B 在 OTA 重启后 topology connection 必须恢复为 `CONNECTED`，不能只是 UI 和 bundleVersion 更新。
5. OTA 链路全绿后，再开始第二个任务：对照旧工程查找“单机 slave 通电/断电提示用户切换主屏/副屏”的逻辑，看新工程是否已实现；若未实现则补齐并完成验证。

## 新会话接手顺序

1. 先读本页和 `ai-result/master-slave-ota-e2e-20260422-063503/`。
2. 确认 mock-terminal-platform server 与 `18889` relay 可用。
3. 恢复 adb 端口：
   - `adb -s emulator-5554 forward tcp:28554 tcp:18584`
   - `adb -s emulator-5556 forward tcp:28556 tcp:18584`
   - `adb -s emulator-5554 forward tcp:18888 tcp:8888`
   - `adb -s emulator-5556 reverse tcp:18889 tcp:18889`
4. 两台模拟器先 force-stop 老进程，再从 `ota.5` upload/release/live verification 开始，不必重新做前半段分析。
5. OTA 验证完成后，再切到“单机 slave 通电/断电提示主副屏切换”的旧逻辑迁移检查。
