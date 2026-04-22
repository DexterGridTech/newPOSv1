---
title: "ui-automation-test-conventions"
tags: ["ui", "automation", "testing", "rn", "assembly"]
created: 2026-04-18T05:57:29.470Z
updated: 2026-04-18T05:57:29.470Z
sources: ["2-ui/2.1-base/README.md", "docs/superpowers/specs/2026-04-18-ui-automation-runtime-design.md"]
links: []
category: convention
confidence: high
schemaVersion: 1
---

# ui-automation-test-conventions

UI 自动化测试约定：1) `2-ui/2.1-base/ui-automation-runtime` 是 UI 自动化与运行时调试的唯一标准入口。2) 业务 rendered/live/assembly 场景测试默认走共享 automation harness，而不是直接使用 `react-test-renderer act`、内部 renderer tree 遍历或包私有协议。3) 推荐高层 helper：`press`、`typeVirtualValue`、`dispatchCommand`、`wait.forNode|Screen|State|Idle`。4) 虚拟键盘字段必须通过 `ui.performAction` 打开 `ui-base-virtual-keyboard` 并逐键点击 `ui-base-virtual-keyboard:key:*`；禁止用 `ui.setValue`/`changeText` 直接改值。5) Android 真机接入统一走 assembly localhost automation host + `adb forward`，RN84 主副屏端口分别是 18584/18585。6) Product 可编入自动化代码，但运行时不得主动启动 automation runtime/host/trace/target registration。
