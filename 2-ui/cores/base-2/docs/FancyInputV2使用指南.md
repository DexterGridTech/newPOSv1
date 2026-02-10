# FancyInputV2 使用指南

## 概述

FancyInputV2 是 FancyInput 的增强版本，主要特点：

1. **编辑预览区域**：键盘上方显示 EditingContent 区域，实时显示正在编辑的内容
2. **确认/取消机制**：用户可以选择确认或取消输入
3. **提示文本**：支持在 EditingContent 左侧显示提示文本
4. **最大长度限制**：超过最大长度时，input 会抖动提示
5. **密码模式**：EditingContent 也支持密文显示
6. **闪烁光标**：EditingContent 中显示闪烁的下划线光标

## 基本用法

### 1. 在应用根组件中添加 Provider 和 Overlay

```tsx
import {
    FancyKeyboardProviderV2,
    FancyContainerV2,
    FancyKeyboardOverlayV2
} from '@impos2/ui-core-base-2';

export const App = () => {
    return (
        <FancyKeyboardProviderV2
            animationDuration={300}
            animationEasing="easeInOut"
        >
            <FancyContainerV2>
                {/* 你的页面内容 */}
                <YourContent />
            </FancyContainerV2>

            {/* 必须添加键盘遮罩层 */}
            <FancyKeyboardOverlayV2 />
        </FancyKeyboardProviderV2>
    );
};
```

### 2. 使用 FancyInputV2 组件

```tsx
import {FancyInputV2} from '@impos2/ui-core-base-2';

export const LoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    return (
        <View>
            {/* 用户名输入 */}
            <FancyInputV2
                value={username}
                onChangeText={setUsername}
                keyboardType="full"
                placeholder="请输入用户名"
                promptText="用户名："
                maxLength={20}
            />

            {/* 密码输入 */}
            <FancyInputV2
                value={password}
                onChangeText={setPassword}
                keyboardType="full"
                placeholder="请输入密码"
                promptText="密码："
                maxLength={16}
                secureTextEntry
            />
        </View>
    );
};
```

## Props 说明

### FancyInputV2Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | - | 输入框的值（必填） |
| onChangeText | (text: string) => void | - | 值改变时的回调（必填） |
| keyboardType | 'full' \| 'number' | 'full' | 键盘类型 |
| onSubmit | () => void | - | 提交时的回调 |
| editable | boolean | true | 是否可编辑 |
| placeholder | string | '' | 占位符文本 |
| placeholderTextColor | string | '#94A3B8' | 占位符颜色 |
| secureTextEntry | boolean | false | 是否密码模式 |
| style | ViewStyle | - | 容器样式 |
| textStyle | TextStyle | - | 文本样式 |
| **promptText** | string | - | 提示文本（显示在 EditingContent 左侧） |
| **maxLength** | number | - | 最大长度限制 |

## 特性说明

### 1. EditingContent 区域

- 固定高度 80px
- 背景色 #F8F9FA，看起来像键盘的延伸
- 文字：24px、加粗、黑色、居中显示
- 左侧显示 promptText（如"用户名："）
- 支持密码模式（显示密文 •）
- 显示闪烁的下划线光标

### 2. 确定和取消按钮

- 位于 EditingContent 和键盘之间
- 高度 60px
- 取消按钮：白色背景，灰色边框
- 确定按钮：蓝色背景，白色文字
- 点击遮罩时，确定按钮会抖动提示

### 3. 最大长度限制

当用户输入超过 `maxLength` 时：
- 不会添加新字符
- input 会抖动提示用户

### 4. 交互逻辑

- **输入时**：不更新 input 的 value，只更新 EditingContent
- **点击确定**：将 EditingContent 内容设置到 input 的 value，关闭键盘
- **点击取消**：不更新 value，直接关闭键盘
- **点击遮罩**：确定按钮抖动提示

## 与 FancyInput 的区别

| 特性 | FancyInput | FancyInputV2 |
|------|-----------|--------------|
| 编辑预览 | 无 | 有 EditingContent 区域 |
| 确认机制 | 实时更新 | 需要点击确定才更新 |
| 取消功能 | 无 | 有取消按钮 |
| 提示文本 | 无 | 支持 promptText |
| 最大长度 | 无 | 支持 maxLength + 抖动提示 |
| 光标显示 | 无 | EditingContent 中显示闪烁光标 |

## 注意事项

1. **不要混用**：FancyInput 和 FancyInputV2 使用不同的 Provider，不要在同一个应用中混用
2. **Provider 层级**：确保 FancyKeyboardProviderV2 在应用的最外层
3. **Overlay 位置**：FancyKeyboardOverlayV2 必须在 FancyContainerV2 外部
4. **最大长度**：设置 maxLength 后，超过长度时 input 会抖动，不会添加新字符

## 完整示例

```tsx
import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
    FancyKeyboardProviderV2,
    FancyContainerV2,
    FancyKeyboardOverlayV2,
    FancyInputV2
} from '@impos2/ui-core-base-2';

export const App = () => {
    return (
        <FancyKeyboardProviderV2>
            <FancyContainerV2>
                <LoginScreen />
            </FancyContainerV2>
            <FancyKeyboardOverlayV2 />
        </FancyKeyboardProviderV2>
    );
};

const LoginScreen = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        console.log('Login:', {username, password});
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <FancyInputV2
                    value={username}
                    onChangeText={setUsername}
                    keyboardType="full"
                    placeholder="请输入用户名"
                    promptText="用户名："
                    maxLength={20}
                    style={styles.input}
                />
            </View>

            <View style={styles.inputContainer}>
                <FancyInputV2
                    value={password}
                    onChangeText={setPassword}
                    keyboardType="full"
                    placeholder="请输入密码"
                    promptText="密码："
                    maxLength={16}
                    secureTextEntry
                    style={styles.input}
                    onSubmit={handleLogin}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    inputContainer: {
        height: 56,
        marginBottom: 16,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        paddingHorizontal: 16,
    },
    input: {
        flex: 1,
    },
});
```

## 设计理念

FancyInputV2 的设计遵循以下原则：

1. **明确的确认机制**：用户可以预览输入内容，确认无误后再提交
2. **清晰的视觉反馈**：EditingContent 区域使用大号加粗字体，确保用户能清楚看到输入内容
3. **友好的错误提示**：超过最大长度时，通过抖动动画提示用户，而不是静默失败
4. **一致的交互体验**：点击遮罩时抖动确定按钮，引导用户做出明确的选择
5. **业界最佳实践**：按钮布局、颜色、大小都参考了业界先进的设计规范
