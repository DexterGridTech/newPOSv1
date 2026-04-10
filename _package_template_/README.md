# 包模板系统

## 概述

本项目使用基于配置的模板引擎来生成新的 Kernel 层和 UI 层包。模板系统使用 `{{VARIABLE_NAME}}` 格式的占位符，通过配置文件定义变量转换规则。

## 目录结构

```
_package_template_/
├── template.config.json    # 模板配置文件
├── kernel-template/         # Kernel 层模板
└── ui-template/            # UI 层模板
```

## 模板变量

### 可用变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `{{PACKAGE_NAME}}` | 包名 (kebab-case) | `mixc-payment` |
| `{{PACKAGE_NAME_PASCAL}}` | 包名 (PascalCase) | `MixcPayment` |
| `{{PACKAGE_NAME_DOT}}` | 包名 (dot.case) | `mixc.payment` |
| `{{PACKAGE_FULL_NAME}}` | 完整包名 | `@impos2/kernel-mixc-payment` |
| `{{MODULE_NAME}}` | 模块名 | `kernel.mixc.payment` |
| `{{PACKAGE_DESCRIPTION}}` | 包描述 | `POS Kernel MixcPayment Module` |
| `{{PACKAGE_TYPE}}` | 包类型 | `kernel` 或 `ui` |
| `{{PACKAGE_TYPE_DISPLAY}}` | 包类型显示名 | `Kernel` 或 `UI` |

### 使用示例

**package.json:**
```json
{
  "name": "{{PACKAGE_FULL_NAME}}",
  "description": "{{PACKAGE_DESCRIPTION}}"
}
```

**moduleName.ts:**
```typescript
export const moduleName = '{{MODULE_NAME}}'
```

**类型定义:**
```typescript
export interface {{PACKAGE_NAME_PASCAL}}State {
  // ...
}
```

## 配置文件

`template.config.json` 定义了变量的转换规则：

```json
{
  "variables": {
    "PACKAGE_NAME_PASCAL": {
      "description": "包名 (PascalCase)",
      "transform": "kebabToPascal"
    },
    "MODULE_NAME": {
      "description": "模块名",
      "template": "{{PACKAGE_TYPE}}.{{PACKAGE_NAME_DOT}}"
    }
  },
  "types": {
    "kernel": {
      "PACKAGE_TYPE": "kernel",
      "PACKAGE_TYPE_DISPLAY": "Kernel"
    }
  }
}
```

### 变量定义类型

1. **转换型变量** (`transform`)：
   - 通过转换函数生成
   - 可用转换：`kebabToPascal`、`kebabToDot`

2. **模板型变量** (`template`)：
   - 通过组合其他变量生成
   - 支持嵌套引用

3. **类型变量** (`types`)：
   - 根据包类型提供不同的值

## 使用脚本

### 生成新包

```bash
yarn create-package
```

### 脚本流程

1. 选择包类型（Kernel 或 UI）
2. 输入包名（kebab-case 格式）
3. 确认生成信息
4. 自动复制模板并替换变量
5. 生成统一结构，但公开导出仍需按包职责手工收口

### 包名规则

- 只能包含小写字母和减号
- 格式：`abc-def`
- 示例：`mixc-payment`、`user-auth`

## 添加新模板

### 1. 创建模板文件

在 `_package_template_/kernel-template/` 或 `ui-template/` 中创建文件。
模板目录只保证统一结构，不代表 `src/foundations` 或内部 feature 目录应该默认对外暴露。

### 2. 使用模板变量

在文件中使用 `{{VARIABLE_NAME}}` 占位符：

```typescript
// src/types/moduleState.ts
export interface {{PACKAGE_NAME_PASCAL}}State {
  // ...
}

export const {{PACKAGE_NAME}}Config = {
  name: '{{MODULE_NAME}}'
}
```

### 3. 添加新变量（可选）

如需新变量，在 `template.config.json` 中添加：

```json
{
  "variables": {
    "MY_NEW_VARIABLE": {
      "description": "我的新变量",
      "template": "{{PACKAGE_NAME}}-suffix"
    }
  }
}
```

## 优势

1. **清晰明确**：变量名一目了然，不会混淆
2. **易于维护**：配置文件集中管理转换规则
3. **可扩展**：轻松添加新变量和转换规则
4. **类型安全**：模板引擎确保所有变量都被正确替换
5. **无依赖**：不依赖外部模板库
6. **边界可控**：模板统一结构，但要求包根入口只显式导出稳定公共 API

## 故障排查

### 变量未被替换

检查：
1. 变量名是否正确（区分大小写）
2. 是否使用了正确的格式 `{{VARIABLE_NAME}}`
3. 配置文件中是否定义了该变量

### 生成的包有问题

1. 检查模板文件是否正确
2. 运行测试脚本验证模板引擎：
   ```bash
   node scripts/test-template-engine.cjs
   ```

### 添加新的转换函数

在 `scripts/create-package.cjs` 中添加转换函数，然后在配置文件中引用。
