# 4-assembly/android

`4-assembly/android` 是 Android 产品 assembly 层。它负责把 reusable host runtime、产品 integration shell、Android application metadata、release manifest、Gradle 打包和最终入口组合成可安装 App。

当前主线 assembly：

| 包 | 定位 |
| --- | --- |
| `mixc-catering-assembly-rn84` | 当前 Android RN84 餐饮终端产品 assembly。 |

## 目录定位

```text
4-assembly/android/*
  -> 3-adapter/android/host-runtime-rn84
  -> 2-ui/2.3-integration/<product-shell>
```

assembly 是最后一层 wiring，不是业务逻辑层。目标是越薄越好。

## 可以放什么

- Android applicationId、namespace、manifest、Gradle 配置。
- 产品 entry `App.tsx`。
- release manifest、release info 生成产物。
- 产品参数选择：productId、appId、runtimeVersion、channel。
- 最终 host runtime 与 product shell 注入。
- assembly 级测试：组合、automation、Gradle、release/hot-update。
- 必要的 metro/react-native 配置。

## 不应该放什么

- 业务主数据 read model。
- 业务 UI 组件实现。
- TCP/TDP/topology 状态机。
- Android adapter 原生能力实现。
- 大量产品无关公共工具。
- 为了赶进度把 lower layer 缺口直接写在 assembly。

## 当前组合规范

`mixc-catering-assembly-rn84` 应保持类似：

```text
App.tsx
  -> @next/host-runtime-rn84
  -> @next/ui-integration-catering-shell
```

不要额外注入 `kernel-business-*` 或 `ui-business-*` 到 assembly/host runtime；业务包由 integration shell 统一组合。

## 发布与热更新

完整 release bundle 与热更新验证使用：

```bash
node scripts/release/release-bundle-full.cjs --app assembly-android-mixc-catering-rn84 --channel production
node scripts/release/package-hot-update.cjs --app assembly-android-mixc-catering-rn84 --channel production
```

Hermes compiler 应由 Gradle 按 OS 解析 `node_modules/hermes-compiler/hermesc/{osx-bin,linux64-bin,win64-bin}`。如果缺失，先在仓库根目录运行 `corepack yarn install` 恢复依赖。

## 新增 assembly 注意事项

1. 先确认是否真的需要新产品 assembly；不要为业务功能新增 assembly。
2. 新 assembly 必须复用 `host-runtime-rn84`，除非有明确 runtime 代际差异。
3. 新产品业务组合应先沉淀到 `2.3-integration/<product-shell>`。
4. App ID、namespace、release manifest、automation 默认包名必须一致更新。
5. 新 assembly 必须提供 Gradle 构建、unit test、automation smoke、release/hot-update 验证路径。

## 历史说明

旧 `mixc-retail-assembly-rn84` 是历史参考/待删除对象，不应再承接新增功能。后续工作应以 `mixc-catering-assembly-rn84` 和更低层可复用能力为主。
