# DeviceStatus 组件实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个纯展示的 DeviceStatus 组件，解决 AdminPopup 中的滚动问题

**Architecture:** 从 DeviceStatusScreen 复制代码并移除 ScrollView，创建一个依赖父容器滚动的纯展示组件。组件保留所有数据获取、UI 渲染和响应式布局逻辑，但不处理滚动。

**Tech Stack:** React Native, TypeScript, StyleSheet

---

## Chunk 1: 创建 DeviceStatus 组件

### Task 1: 创建 DeviceStatus 组件文件

**Files:**
- Create: `2-ui/2.1-cores/admin/src/ui/components/DeviceStatus.tsx`
- Reference: `2-ui/2.1-cores/admin/src/ui/screens/DeviceStatusScreen.tsx`

- [ ] **Step 1: 创建组件目录（如果不存在）**

从项目根目录执行：

```bash
mkdir -p 2-ui/2.1-cores/admin/src/ui/components
```

- [ ] **Step 2: 复制 DeviceStatusScreen.tsx 到新位置**

从项目根目录执行：

```bash
cp 2-ui/2.1-cores/admin/src/ui/screens/DeviceStatusScreen.tsx 2-ui/2.1-cores/admin/src/ui/components/DeviceStatus.tsx
```

- [ ] **Step 3: 修改组件名称**

在 `2-ui/2.1-cores/admin/src/ui/components/DeviceStatus.tsx` 中，找到第200行：

修改前：
```typescript
export const DeviceStatusScreen: React.FC = () => {
```

修改后：
```typescript
export const DeviceStatus: React.FC = () => {
```

- [ ] **Step 4: 修改根样式，移除 flex: 1**

在同一文件中，找到第337行的样式定义：

修改前：
```typescript
root: {flex: 1, backgroundColor: C.bg},
```

修改后：
```typescript
root: {backgroundColor: C.bg},
```

- [ ] **Step 5: 验证代码编译**

从项目根目录执行：

```bash
cd 2-ui/2.1-cores/admin && yarn tsc --noEmit && cd ../../..
```

Expected: 无编译错误

- [ ] **Step 6: Commit**

从项目根目录执行：

```bash
git add 2-ui/2.1-cores/admin/src/ui/components/DeviceStatus.tsx && git commit -m "feat(admin): create DeviceStatus component for AdminPopup

- Copy from DeviceStatusScreen
- Rename to DeviceStatus
- Remove flex: 1 from root style to enable parent scrolling"
```

---

## Chunk 2: 集成到 AdminPopup

### Task 2: 在 AdminPopup 中使用 DeviceStatus

**Files:**
- Modify: `2-ui/2.1-cores/admin/src/ui/modals/AdminPopup.tsx:4-5,166`

- [ ] **Step 1: 添加 DeviceStatus 导入**

在文件顶部，在第4行和第5行之间插入新的导入：

修改前（第4-5行）：
```typescript
import {DeviceStatusScreen} from '../screens/deviceStatusScreen';
import {TerminalConnectionScreen} from '../screens/terminalConnectionScreen';
```

修改后：
```typescript
import {DeviceStatusScreen} from '../screens/deviceStatusScreen';
import {DeviceStatus} from '../components/DeviceStatus';
import {TerminalConnectionScreen} from '../screens/terminalConnectionScreen';
```

- [ ] **Step 2: 替换 DeviceStatusScreen 为 DeviceStatus**

在 ScrollView 内部第166行：

修改前：
```typescript
{selectedMenu === 'device' && <DeviceStatusScreen />}
```

修改后：
```typescript
{selectedMenu === 'device' && <DeviceStatus />}
```

- [ ] **Step 3: 验证代码编译**

从项目根目录执行：

```bash
cd 2-ui/2.1-cores/admin && yarn tsc --noEmit && cd ../../..
```

Expected: 无编译错误

- [ ] **Step 4: Commit**

从项目根目录执行：

```bash
git add 2-ui/2.1-cores/admin/src/ui/modals/AdminPopup.tsx && git commit -m "feat(admin): use DeviceStatus in AdminPopup

- Replace DeviceStatusScreen with DeviceStatus
- Enables proper scrolling in AdminPopup"
```

---

## Chunk 3: 测试和验证

### Task 3: 验证编译和构建

**Files:**
- Test: 编译和构建验证

- [ ] **Step 1: 清理并重新构建**

从项目根目录执行：

```bash
cd 2-ui/2.1-cores/admin && yarn tsc --noEmit && cd ../../..
```

Expected: 无编译错误

- [ ] **Step 2: 启动开发服务器**

从项目根目录执行：

```bash
npm run assembly:android-mixc-retail:start
```

Expected: Metro bundler 启动成功，显示 "info Dev server ready"

- [ ] **Step 3: 等待编译完成**

观察终端输出，等待 bundle 完成

Expected: 显示 "BUNDLE ./index.js" 且无 SyntaxError

- [ ] **Step 4: 创建测试报告目录**

从项目根目录执行：

```bash
mkdir -p docs/superpowers/test-results
```

- [ ] **Step 5: 记录编译结果**

从项目根目录执行：

```bash
cat > docs/superpowers/test-results/2026-03-10-device-status-build.md << 'EOF'
# DeviceStatus 组件构建验证

**日期**: 2026-03-10

## 构建结果
- TypeScript 编译: PASS
- Metro bundler: PASS
- 无语法错误: PASS

## 下一步
需要在设备上手动测试：
1. 长按屏幕 2 秒打开 AdminPopup
2. 输入密码 "123"
3. 点击"设备状态"菜单
4. 验证内容可以滚动
5. 验证所有 Section 可见

EOF
```

- [ ] **Step 6: Commit 测试报告**

从项目根目录执行：

```bash
git add docs/superpowers/test-results/2026-03-10-device-status-build.md && git commit -m "test(admin): add DeviceStatus build verification results"
```

---

## 完成检查清单

实现完成后，验证以下内容：

- [ ] DeviceStatus 组件已创建
- [ ] AdminPopup 已更新使用 DeviceStatus
- [ ] 代码编译无错误
- [ ] 滚动功能正常工作
- [ ] 所有内容可见
- [ ] 响应式布局正常
- [ ] 已提交所有更改

## 回滚计划

如果实现失败，回滚步骤：

```bash
# 回滚到实现前的状态
git reset --hard HEAD~3

# 或者只删除新文件
rm 2-ui/2.1-cores/admin/src/ui/components/DeviceStatus.tsx
git checkout 2-ui/2.1-cores/admin/src/ui/modals/AdminPopup.tsx
```

## 注意事项

1. **不要修改 DeviceStatusScreen** - 保持原文件不变，以便其他地方继续使用
2. **保持样式一致** - DeviceStatus 应该与 DeviceStatusScreen 视觉效果相同
3. **测试充分** - 确保滚动在不同内容长度下都正常工作
4. **提交频繁** - 每个任务完成后立即提交
