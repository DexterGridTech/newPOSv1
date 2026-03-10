# DeviceStatus 组件设计文档

**日期**: 2026-03-10
**目标**: 创建一个纯展示的设备状态组件，解决 AdminPopup 中的滚动问题

## 背景

当前 AdminPopup 中使用的 DeviceStatusScreen 组件存在滚动问题：
- DeviceStatusScreen 原本使用 ScrollView 作为根元素
- 为了避免嵌套滚动，改为 View 后，内容无法在 AdminPopup 的 ScrollView 中正常滚动
- 需要创建一个专门为 AdminPopup 优化的纯展示组件

## 设计目标

1. **解决滚动问题** - 避免嵌套 ScrollView，依赖父容器滚动
2. **简化组件结构** - 组件只负责展示，不处理滚动逻辑
3. **保持功能完整** - 保留所有 UI、数据获取和响应式布局功能
4. **提升代码可维护性** - 清晰的职责分离

## 组件设计

### 组件结构

```
DeviceStatus (纯 View，无 ScrollView)
  └─ 内容容器 (View)
      ├─ Header (标题 + 时间戳)
      ├─ 设备信息 Section
      ├─ 显示器 Section
      ├─ 资源占用 Section (CPU/内存/磁盘进度条)
      ├─ 网络 Section
      └─ 外设 Section (Tab 切换: USB/蓝牙/串口/应用)
```

### 关键设计决策

**1. 滚动处理**
- 组件不包含 ScrollView
- 根元素使用普通 View，不设置 `flex: 1`
- 让内容自然撑开，由父容器的 ScrollView 处理滚动

**2. 样式调整**
- 移除根元素的 `flex: 1` 样式
- 保留所有其他样式和布局逻辑
- 内容容器使用 padding 而非 contentContainerStyle

**3. 数据获取**
- 保持与 DeviceStatusScreen 相同的数据获取逻辑
- 使用 `device.getDeviceInfo()` 和 `device.getSystemStatus()`
- 保留 loading 状态和错误处理

**4. 响应式布局**
- 保持响应式布局支持
- 使用 `getResponsiveLayout()` 获取布局参数
- 监听屏幕尺寸变化

### 组件接口

```typescript
export const DeviceStatus: React.FC = () => {
  // 无 props，完全自包含
}
```

### 与 DeviceStatusScreen 的区别

| 特性 | DeviceStatusScreen | DeviceStatus |
|------|-------------------|--------------|
| 根元素 | ScrollView | View |
| 根样式 | `flex: 1` | 无 flex |
| 滚动处理 | 自己处理 | 依赖父容器 |
| 导出方式 | 导出为 Screen | 不导出（私有） |
| 使用场景 | 独立页面 | AdminPopup 内部 |

## 实现计划

1. 创建 `/2-ui/2.1-cores/admin/src/ui/components/DeviceStatus.tsx`
2. 从 DeviceStatusScreen 复制代码
3. 修改根元素：ScrollView → View
4. 移除根样式的 `flex: 1`
5. 调整内容容器样式
6. 在 AdminPopup 中导入并使用
7. 测试滚动功能

## 预期效果

- AdminPopup 的 ScrollView 可以正常滚动
- DeviceStatus 内容完整显示
- 响应式布局正常工作
- 性能优于嵌套 ScrollView 方案
