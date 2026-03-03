# IMPos2 - 企业级 POS 系统

基于 Monorepo 架构的企业级 React Native 裸工程项目，采用分层设计理念。

## 📋 项目架构

项目采用 4 层架构设计：

- **0-mock-server**: Mock 服务层（开发调试用）
- **1-kernel**: 业务逻辑层（Redux Toolkit + Redux Observable）
- **2-ui**: UI 层（React Native + Expo）
- **3-adapter**: 适配层（React Native 裸工程，Android 原生适配）
- **4-assembly**: 整合层（最终产品集成）

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **Yarn**: 3.6.4（项目自带，通过 corepack 管理）
- **Java**: JDK 17+（Android 开发）
- **Android SDK**: API Level 34+
- **操作系统**: macOS / Linux / Windows

### 一键安装

```bash
# 克隆项目
git clone <your-repo-url>
cd newPOSv1

# 运行自动化安装脚本
chmod +x setup.sh
./setup.sh
```

### 手动安装

如果自动化脚本遇到问题，可以手动执行以下步骤：

```bash
# 1. 启用 corepack（Node.js 16.9+ 自带）
corepack enable

# 2. 安装依赖
corepack yarn install

# 3. 配置 Android 环境变量（如果未配置）
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# 或
export ANDROID_HOME=$HOME/Android/Sdk          # Linux
# 或
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk    # Windows

# 4. 验证环境
node scripts/check-env.js
```

## 📦 常用命令

### 依赖管理

```bash
# 安装所有依赖
yarn install

# 清理并重新安装
yarn clean && yarn install

# 为特定 workspace 添加依赖
yarn workspace @impos2/xxx add <package-name>
```

### 构建

```bash
# 构建所有包
yarn build

# 强制重新构建
yarn build:clean

# 类型检查
yarn type-check
```

### 开发调试

```bash
# 启动 Mock 服务器
yarn A:kernel-server        # Kernel 服务器
yarn B:master-ws-server      # WebSocket 服务器

# 启动 UI 模块（Web 调试）
yarn ui:module-device-activate-2
yarn ui:module-user-login-2
yarn ui:integrate-desktop-2

# 启动适配层（Android）
yarn adapter:impos2-adapter-v1:start

# 启动整合层（完整应用）
yarn assembly:impos2-desktop-v1:start
```

### Android 相关

```bash
# 端口转发（Android 设备访问本地服务）
yarn android:port-forward

# 查看端口转发列表
yarn android:port-list

# 清除端口转发
yarn android:port-clear

# 杀死占用的端口
yarn kill-port
```

## 🔧 环境配置

### Android SDK 配置

项目需要配置 Android SDK 路径。有两种方式：

#### 方式 1: 环境变量（推荐）

在 `~/.zshrc` 或 `~/.bashrc` 中添加：

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

然后执行：
```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

#### 方式 2: local.properties

如果环境变量未设置，可以在以下位置创建 `local.properties` 文件：

- `3-adapter/android/IMPos2AdapterV1/android/local.properties`
- `4-assembly/android/IMPos2DesktopV1/android/local.properties`

内容：
```properties
sdk.dir=/Users/你的用户名/Library/Android/sdk
```

**注意**: `local.properties` 已在 `.gitignore` 中，不会被提交到 Git。

### 网络代理配置（可选）

如果遇到网络问题，可以配置代理：

```bash
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
```

## 📁 项目结构

```
newPOSv1/
├── 0-mock-server/          # Mock 服务器
│   ├── kernel-server/      # Kernel API 服务
│   └── master-ws-server/   # WebSocket 服务
├── 1-kernel/               # 业务逻辑层
│   ├── base/               # 核心基础包
│   └── modules/            # 业务模块
├── 2-ui/                   # UI 层
│   ├── cores/              # UI 核心包
│   ├── modules/            # UI 模块
│   └── integrates/         # UI 集成包
├── 3-adapter/              # 适配层
│   └── android/            # Android 适配
├── 4-assembly/             # 整合层
│   └── android/            # Android 应用
├── scripts/                # 工具脚本
├── .yarn/                  # Yarn 配置
│   └── releases/           # Yarn 版本（已提交）
├── package.json            # 根配置
├── turbo.json              # Turbo 构建配置
├── tsconfig.base.json      # TypeScript 基础配置
└── CLAUDE.md               # AI 开发指南
```

## 🛠️ 技术栈

- **包管理**: Yarn 3.6.4 (Workspaces)
- **构建工具**: Turbo
- **语言**: TypeScript 5.9+
- **UI 框架**: React Native 0.76.6 + Expo
- **状态管理**: Redux Toolkit 2.11+ + Redux Observable
- **原生通信**: TurboModule + Hermes
- **Android**: Kotlin + Gradle

## 🐛 常见问题

### 1. `corepack: command not found`

**解决方案**: 升级 Node.js 到 16.9+ 或手动安装 corepack：
```bash
npm install -g corepack
corepack enable
```

### 2. Android SDK 找不到

**解决方案**:
- 确保已安装 Android Studio
- 配置 `ANDROID_HOME` 环境变量
- 或创建 `local.properties` 文件

### 3. Yarn 安装依赖失败

**解决方案**:
```bash
# 清理缓存
yarn cache clean

# 删除 node_modules 和 lock 文件
rm -rf node_modules yarn.lock

# 重新安装
yarn install
```

### 4. 端口被占用

**解决方案**:
```bash
# 使用项目提供的脚本
yarn kill-port

# 或手动查找并杀死进程
lsof -ti:8081 | xargs kill -9  # Metro bundler
lsof -ti:3000 | xargs kill -9  # Web 服务
```

### 5. Android 构建失败

**解决方案**:
```bash
# 清理 Android 构建缓存
cd 4-assembly/android/IMPos2DesktopV1/android
./gradlew clean

# 或使用项目命令
yarn clean
```

## 📝 开发规范

详细的开发规范和架构设计请参考 [CLAUDE.md](./CLAUDE.md)

核心原则：
1. 全程使用中文沟通
2. 模块与功能设计考虑抽象与复用
3. 代码简洁，优先使用类型而非字符串
4. 变量统一维护，避免硬编码
5. 配置文件禁止使用绝对路径
6. 使用 Yarn Workspace 管理 Monorepo
7. 强类型管控（TypeScript）
8. React Native 组件必须 100% 兼容裸工程

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

[添加你的许可证信息]

## 📧 联系方式

[添加你的联系方式]
