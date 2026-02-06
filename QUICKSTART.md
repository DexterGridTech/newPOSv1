# 快速开始指南

本指南帮助你快速设置和运行 IMPos2 项目。

## 📋 前置要求

在开始之前，请确保你的系统已安装以下软件：

### 必需软件

1. **Node.js** (>= 18.0.0)
   - 下载: https://nodejs.org/
   - 验证: `node -v`

2. **Git**
   - 下载: https://git-scm.com/
   - 验证: `git --version`

### Android 开发（可选）

如果需要进行 Android 开发，还需要：

3. **Java JDK** (>= 17)
   - 下载: https://adoptium.net/
   - 验证: `java -version`

4. **Android Studio**
   - 下载: https://developer.android.com/studio
   - 安装后配置 Android SDK

## 🚀 安装步骤

### 方法 1: 自动安装（推荐）

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd newPOSv1

# 2. 运行自动安装脚本
chmod +x setup.sh
./setup.sh
```

安装脚本会自动：
- ✓ 检查 Node.js 版本
- ✓ 启用 Corepack
- ✓ 检查 Java 和 Android SDK
- ✓ 安装项目依赖
- ✓ 配置 Android 环境
- ✓ 验证安装

### 方法 2: 手动安装

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd newPOSv1

# 2. 启用 Corepack
corepack enable

# 3. 安装依赖
yarn install

# 4. 验证环境
node scripts/check-env.js
```

## 🔧 配置 Android 环境

### 设置 ANDROID_HOME 环境变量

#### macOS / Linux

编辑 `~/.zshrc` 或 `~/.bashrc`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# 或
export ANDROID_HOME=$HOME/Android/Sdk          # Linux

export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

然后执行:
```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

#### Windows

1. 打开"系统属性" > "高级" > "环境变量"
2. 新建系统变量:
   - 变量名: `ANDROID_HOME`
   - 变量值: `C:\Users\你的用户名\AppData\Local\Android\Sdk`
3. 编辑 `Path` 变量，添加:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\tools`

### 或使用 local.properties（备选方案）

如果不想设置环境变量，可以在以下位置创建 `local.properties` 文件：

```
3-adapter/android/IMPos2AdapterV1/android/local.properties
4-assembly/android/IMPos2DesktopV1/android/local.properties
```

内容：
```properties
sdk.dir=/Users/你的用户名/Library/Android/sdk
```

可以参考项目根目录的 `local.properties.template` 模板。

## 🎯 启动项目

### 1. 启动 Mock 服务器

```bash
# 终端 1: 启动 Kernel 服务器
yarn A:kernel-server

# 终端 2: 启动 WebSocket 服务器
yarn B:master-ws-server
```

### 2. 启动 UI 开发（Web）

```bash
# 启动 UI 集成包（Web 调试）
yarn ui:integrate-desktop-2
```

浏览器访问: http://localhost:5173

### 3. 启动 Android 应用

```bash
# 确保 Android 设备已连接或模拟器已启动
adb devices

# 启动完整应用
yarn assembly:impos2-desktop-v1:start
```

## 📱 Android 设备配置

### 连接真机

1. 在 Android 设备上启用"开发者选项"和"USB 调试"
2. 用 USB 连接设备到电脑
3. 验证连接: `adb devices`

### 端口转发（访问本地服务）

```bash
# 设置端口转发
yarn android:port-forward

# 查看端口转发列表
yarn android:port-list

# 清除端口转发
yarn android:port-clear
```

## 🐛 常见问题

### 问题 1: `corepack: command not found`

**原因**: Node.js 版本过低或 corepack 未启用

**解决**:
```bash
# 升级 Node.js 到 18.0.0+
# 或手动安装 corepack
npm install -g corepack
corepack enable
```

### 问题 2: `ANDROID_HOME is not set`

**原因**: Android SDK 环境变量未配置

**解决**: 参考上面的"配置 Android 环境"章节

### 问题 3: 依赖安装失败

**解决**:
```bash
# 清理缓存
yarn cache clean

# 删除 node_modules
rm -rf node_modules

# 重新安装
yarn install
```

### 问题 4: 端口被占用

**解决**:
```bash
# 使用项目脚本
yarn kill-port

# 或手动杀死进程
lsof -ti:8081 | xargs kill -9  # Metro
lsof -ti:3000 | xargs kill -9  # Web
```

### 问题 5: Android 构建失败

**解决**:
```bash
# 清理 Android 构建缓存
cd 4-assembly/android/IMPos2DesktopV1/android
./gradlew clean

# 返回项目根目录
cd ../../../..

# 重新构建
yarn assembly:impos2-desktop-v1:start
```

## 📚 下一步

- 查看 [README.md](./README.md) 了解完整的项目文档
- 查看 [CLAUDE.md](./CLAUDE.md) 了解开发规范和架构设计
- 运行 `node scripts/check-env.js` 验证环境配置

## 💡 提示

1. **首次运行**: 首次启动 Android 应用可能需要较长时间，因为需要下载 Gradle 依赖
2. **网络问题**: 如遇到网络问题，可以配置代理（参考 README.md）
3. **开发模式**: 开发时建议同时启动 Mock 服务器和 UI 开发服务器
4. **热重载**: 修改代码后，React Native 会自动热重载，无需重启应用

## 🆘 获取帮助

如果遇到问题：

1. 运行环境检查: `node scripts/check-env.js`
2. 查看日志输出，定位错误信息
3. 参考 README.md 的"常见问题"章节
4. 提交 Issue 到项目仓库

---

祝你开发愉快！🎉
