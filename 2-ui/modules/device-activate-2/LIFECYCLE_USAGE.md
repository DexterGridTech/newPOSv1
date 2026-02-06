# useDeviceActivate 生命周期使用指南

## 概述

`useDeviceActivate` Hook 现在支持监听组件的生命周期事件（挂载和卸载），让你可以在组件启动和销毁时执行自定义逻辑。

## 基本用法

### 1. 不使用生命周期回调（向后兼容）

```typescript
import { useDeviceActivate } from '../hooks/useDeviceActivateV2';

const MyComponent = () => {
    const {
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit
    } = useDeviceActivate();
    
    // 使用 hook 返回的状态和方法
};
```

### 2. 使用生命周期回调

```typescript
import { useDeviceActivate } from '../hooks/useDeviceActivateV2';

const MyComponent = () => {
    const {
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit
    } = useDeviceActivate({
        lifecycle: {
            onMount: () => {
                console.log('组件已挂载！');
                // 执行初始化逻辑
                // 例如：加载配置、启动定时器等
            },
            onUnmount: () => {
                console.log('组件即将卸载！');
                // 执行清理逻辑
                // 例如：清除定时器、取消请求等
            }
        }
    });
    
    // 使用 hook 返回的状态和方法
};
```

### 3. 禁用生命周期日志

```typescript
const MyComponent = () => {
    const {
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit
    } = useDeviceActivate({
        enableLifecycleLog: false, // 禁用自动日志
        lifecycle: {
            onMount: () => {
                // 自定义挂载逻辑
            },
            onUnmount: () => {
                // 自定义卸载逻辑
            }
        }
    });
};
```

## 完整示例

### 示例 1：启动时加载配置

```typescript
import React from 'react';
import { useDeviceActivate } from '../hooks/useDeviceActivateV2';
import { ActivateForm } from './ActivateForm/ActivateFormV2';

export const ActivateFormContainer = () => {
    const {
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit
    } = useDeviceActivate({
        lifecycle: {
            onMount: () => {
                // 组件挂载时加载配置
                console.log('激活表单已加载');
                // 可以在这里加载默认配置、预填充数据等
            },
            onUnmount: () => {
                // 组件卸载时清理
                console.log('激活表单已卸载');
                // 可以在这里清理资源、保存状态等
            }
        }
    });

    return (
        <ActivateForm
            activationCode={activationCode}
            activateStatus={activateStatus}
            onActivationCodeChange={handleActivationCodeChange}
            onSubmit={handleSubmit}
        />
    );
};
```

### 示例 2：启动定时器

```typescript
import React, { useRef } from 'react';
import { useDeviceActivate } from '../hooks/useDeviceActivateV2';

export const ActivateFormWithTimer = () => {
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const {
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit
    } = useDeviceActivate({
        lifecycle: {
            onMount: () => {
                // 启动定时器
                timerRef.current = setInterval(() => {
                    console.log('定时检查激活状态...');
                }, 5000);
            },
            onUnmount: () => {
                // 清除定时器
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        }
    });

    return (
        <ActivateForm
            activationCode={activationCode}
            activateStatus={activateStatus}
            onActivationCodeChange={handleActivationCodeChange}
            onSubmit={handleSubmit}
        />
    );
};
```

### 示例 3：统计页面停留时间

```typescript
import React, { useRef } from 'react';
import { useDeviceActivate } from '../hooks/useDeviceActivateV2';

export const ActivateFormWithAnalytics = () => {
    const startTimeRef = useRef<number>(0);

    const {
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit
    } = useDeviceActivate({
        lifecycle: {
            onMount: () => {
                // 记录进入时间
                startTimeRef.current = Date.now();
                console.log('用户进入激活页面');
            },
            onUnmount: () => {
                // 计算停留时间
                const duration = Date.now() - startTimeRef.current;
                console.log(`用户在激活页面停留了 ${duration}ms`);
                // 可以在这里上报统计数据
            }
        }
    });

    return (
        <ActivateForm
            activationCode={activationCode}
            activateStatus={activateStatus}
            onActivationCodeChange={handleActivationCodeChange}
            onSubmit={handleSubmit}
        />
    );
};
```

## API 参考

### UseDeviceActivateConfig

```typescript
interface UseDeviceActivateConfig {
    /**
     * 生命周期回调
     */
    lifecycle?: LifecycleCallbacks;
    /**
     * 是否启用生命周期日志
     * @default true
     */
    enableLifecycleLog?: boolean;
}
```

### LifecycleCallbacks

```typescript
interface LifecycleCallbacks {
    /**
     * 组件挂载时的回调
     */
    onMount?: () => void;
    /**
     * 组件卸载时的回调
     */
    onUnmount?: () => void;
}
```

## 日志输出

当 `enableLifecycleLog` 为 `true`（默认值）时，Hook 会自动输出以下日志：

### 挂载时
```
[useDeviceActivate] Component mounted
{
  timestamp: "2026-02-06T10:30:00.000Z",
  activationCode: "empty"
}
```

### 卸载时
```
[useDeviceActivate] Component unmounting
{
  timestamp: "2026-02-06T10:35:00.000Z",
  finalActivationCode: "ABC123",
  finalStatus: "success"
}

[useDeviceActivate] Component unmounted and resources released
```

## 注意事项

1. **错误处理**：生命周期回调中的错误会被自动捕获并记录，不会影响组件的正常运行
2. **执行时机**：
   - `onMount` 在组件首次渲染后执行
   - `onUnmount` 在组件卸载前执行
3. **依赖数组**：生命周期 useEffect 使用空依赖数组，确保只在挂载和卸载时执行一次
4. **向后兼容**：不传递 config 参数时，Hook 行为与之前完全一致

## 最佳实践

1. **清理资源**：在 `onUnmount` 中清理所有在 `onMount` 中创建的资源（定时器、监听器等）
2. **避免副作用**：不要在生命周期回调中直接修改组件状态
3. **错误处理**：在回调中添加适当的错误处理逻辑
4. **日志控制**：在生产环境中考虑禁用 `enableLifecycleLog` 以减少日志输出
