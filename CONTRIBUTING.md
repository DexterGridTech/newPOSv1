# 贡献指南

感谢你对 IMPos2 项目的关注！本文档将帮助你了解如何为项目做出贡献。

## 📋 开始之前

在开始贡献之前，请确保：

1. 已阅读 [README.md](./README.md) 了解项目概况
2. 已阅读 [QUICKSTART.md](./QUICKSTART.md) 完成环境搭建
3. 已阅读 [CLAUDE.md](./CLAUDE.md) 了解开发规范

## 🔧 开发环境设置

### 1. Fork 并克隆项目

```bash
# Fork 项目到你的 GitHub 账号
# 然后克隆你的 Fork
git clone https://github.com/你的用户名/newPOSv1.git
cd newPOSv1

# 添加上游仓库
git remote add upstream https://github.com/原作者/newPOSv1.git
```

### 2. 安装依赖

```bash
# 运行自动安装脚本
./setup.sh

# 或手动安装
corepack enable
yarn install
```

### 3. 验证环境

```bash
# 运行环境检查
yarn check-env

# 运行类型检查
yarn type-check
```

## 🌿 分支管理

### 分支命名规范

- `feature/功能名称` - 新功能开发
- `fix/问题描述` - Bug 修复
- `refactor/重构内容` - 代码重构
- `docs/文档更新` - 文档更新
- `test/测试内容` - 测试相关
- `chore/杂项` - 构建、配置等杂项

### 创建分支

```bash
# 确保主分支是最新的
git checkout main
git pull upstream main

# 创建新分支
git checkout -b feature/your-feature-name
```

## 💻 开发流程

### 1. 编写代码

遵循项目的开发规范（详见 CLAUDE.md）：

- 使用 TypeScript 开发，强类型管控
- 代码简洁，考虑抽象与复用
- 变量统一维护，避免硬编码
- 配置文件禁止使用绝对路径
- React Native 组件必须 100% 兼容裸工程

### 2. 代码检查

```bash
# 类型检查
yarn type-check

# 代码格式化（如果配置了）
yarn lint

# 构建测试
yarn build
```

### 3. 测试

```bash
# 运行测试（如果有）
yarn test

# 手动测试
# - 启动 Mock 服务器
# - 启动 UI 开发服务器
# - 启动 Android 应用
# - 验证功能正常
```

### 4. 提交代码

#### 提交信息规范

使用语义化提交信息：

```
<类型>(<范围>): <简短描述>

<详细描述>

<关联 Issue>
```

**类型**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建、配置等杂项

**示例**:

```bash
git commit -m "feat(ui): 添加用户登录界面

- 实现登录表单组件
- 添加表单验证逻辑
- 集成 Redux 状态管理

Closes #123"
```

### 5. 推送代码

```bash
# 推送到你的 Fork
git push origin feature/your-feature-name
```

## 🔀 提交 Pull Request

### 1. 创建 PR

1. 访问你的 Fork 仓库
2. 点击 "New Pull Request"
3. 选择目标分支（通常是 `main`）
4. 填写 PR 标题和描述

### 2. PR 描述模板

```markdown
## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 代码重构
- [ ] 文档更新
- [ ] 其他

## 变更描述
简要描述你的变更内容

## 相关 Issue
Closes #issue_number

## 测试
描述你如何测试这些变更

## 截图（如适用）
添加截图帮助说明变更

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 已进行类型检查
- [ ] 已进行测试
- [ ] 已更新相关文档
- [ ] 提交信息符合规范
```

### 3. 代码审查

- 等待维护者审查你的代码
- 根据反馈进行修改
- 保持沟通，及时回复评论

### 4. 合并

- PR 被批准后，维护者会合并你的代码
- 合并后可以删除你的分支

## 📝 代码规范

### TypeScript 规范

```typescript
// ✓ 好的示例
interface UserInfo {
  id: string;
  name: string;
  role: UserRole;
}

enum UserRole {
  Admin = 'ADMIN',
  User = 'USER',
}

// ✗ 不好的示例
const userRole = 'admin'; // 应该使用枚举
```

### 命名规范

- **文件名**: kebab-case（如 `user-login.tsx`）
- **组件名**: PascalCase（如 `UserLogin`）
- **函数名**: camelCase（如 `getUserInfo`）
- **常量名**: UPPER_SNAKE_CASE（如 `API_BASE_URL`）
- **类型/接口**: PascalCase（如 `UserInfo`）

### 目录结构

遵循项目的 4 层架构：

```
0-mock-server/   # Mock 服务层
1-kernel/        # 业务逻辑层
2-ui/            # UI 层
3-adapter/       # 适配层
4-assembly/      # 整合层
```

## 🐛 报告 Bug

### Bug 报告模板

```markdown
## Bug 描述
清晰简洁地描述 Bug

## 复现步骤
1. 执行 '...'
2. 点击 '...'
3. 滚动到 '...'
4. 看到错误

## 期望行为
描述你期望发生什么

## 实际行为
描述实际发生了什么

## 截图
如果适用，添加截图

## 环境信息
- OS: [如 macOS 13.0]
- Node.js: [如 v18.0.0]
- Yarn: [如 3.6.4]
- React Native: [如 0.76.6]

## 额外信息
添加其他相关信息
```

## 💡 功能建议

### 功能建议模板

```markdown
## 功能描述
清晰简洁地描述你想要的功能

## 问题背景
这个功能解决什么问题？

## 建议方案
描述你期望的解决方案

## 备选方案
描述你考虑过的其他方案

## 额外信息
添加其他相关信息
```

## 📚 文档贡献

文档同样重要！你可以：

- 修正文档中的错误
- 改进文档的清晰度
- 添加示例和教程
- 翻译文档

## ❓ 获取帮助

如果你有任何问题：

1. 查看 [README.md](./README.md) 和 [QUICKSTART.md](./QUICKSTART.md)
2. 搜索现有的 Issues
3. 在 Discussions 中提问
4. 联系维护者

## 🙏 致谢

感谢所有为项目做出贡献的开发者！

---

再次感谢你的贡献！🎉
