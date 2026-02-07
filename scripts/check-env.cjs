#!/usr/bin/env node

/**
 * 环境检查脚本
 * 检查项目运行所需的所有环境配置
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// 打印函数
function printInfo(msg) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`);
}

function printSuccess(msg) {
  console.log(`${colors.green}[✓]${colors.reset} ${msg}`);
}

function printWarning(msg) {
  console.log(`${colors.yellow}[!]${colors.reset} ${msg}`);
}

function printError(msg) {
  console.log(`${colors.red}[✗]${colors.reset} ${msg}`);
}

function printHeader(msg) {
  console.log('');
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}${msg}${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log('');
}

// 执行命令并返回结果
function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    return null;
  }
}

// 检查命令是否存在
function commandExists(command) {
  return execCommand(`which ${command}`) !== null;
}

// 检查 Node.js
function checkNode() {
  printHeader('检查 Node.js 环境');

  if (!commandExists('node')) {
    printError('Node.js 未安装');
    printInfo('请访问 https://nodejs.org/ 下载安装');
    return false;
  }

  const nodeVersion = execCommand('node -v');
  const nodeMajor = parseInt(nodeVersion.replace('v', '').split('.')[0]);

  if (nodeMajor < 18) {
    printError(`Node.js 版本过低: ${nodeVersion} (需要 >= 18.0.0)`);
    return false;
  }

  printSuccess(`Node.js 版本: ${nodeVersion}`);
  return true;
}

// 检查 Yarn
function checkYarn() {
  printHeader('检查 Yarn 环境');

  if (!commandExists('corepack')) {
    printError('Corepack 未启用');
    printInfo('运行: corepack enable');
    return false;
  }

  printSuccess('Corepack 已启用');

  const yarnVersion = execCommand('yarn -v');
  if (yarnVersion) {
    printSuccess(`Yarn 版本: ${yarnVersion}`);
  } else {
    printWarning('无法获取 Yarn 版本');
  }

  // 检查 .yarn/releases 目录
  const yarnReleasePath = path.join(process.cwd(), '.yarn', 'releases', 'yarn-3.6.4.cjs');
  if (fs.existsSync(yarnReleasePath)) {
    printSuccess('Yarn 3.6.4 二进制文件存在');
  } else {
    printError('Yarn 3.6.4 二进制文件不存在');
    return false;
  }

  return true;
}

// 检查 Java
function checkJava() {
  printHeader('检查 Java 环境');

  if (!commandExists('java')) {
    printWarning('Java 未安装（Android 开发需要）');
    printInfo('请访问 https://adoptium.net/ 下载安装 JDK 17+');
    return false;
  }

  const javaVersion = execCommand('java -version 2>&1 | head -n 1');
  printSuccess(`Java 版本: ${javaVersion}`);

  return true;
}

// 检查 Android SDK
function checkAndroidSDK() {
  printHeader('检查 Android SDK');

  const androidHome = process.env.ANDROID_HOME;

  if (!androidHome) {
    printWarning('ANDROID_HOME 环境变量未设置');
    printInfo('请在 ~/.zshrc 或 ~/.bashrc 中添加:');
    console.log('  export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS');
    console.log('  export PATH=$PATH:$ANDROID_HOME/platform-tools');
    return false;
  }

  printSuccess(`ANDROID_HOME: ${androidHome}`);

  if (!fs.existsSync(androidHome)) {
    printError('ANDROID_HOME 路径不存在');
    return false;
  }

  printSuccess('Android SDK 路径有效');

  // 检查 adb
  if (commandExists('adb')) {
    const adbVersion = execCommand('adb version | head -n 1');
    printSuccess(`ADB: ${adbVersion}`);
  } else {
    printWarning('ADB 未在 PATH 中');
  }

  return true;
}

// 检查项目依赖
function checkDependencies() {
  printHeader('检查项目依赖');

  const nodeModulesPath = path.join(process.cwd(), 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    printError('node_modules 不存在');
    printInfo('运行: yarn install');
    return false;
  }

  printSuccess('node_modules 存在');

  // 检查关键依赖
  const criticalDeps = [
    'react',
    'react-native',
    'typescript',
    'turbo',
    '@reduxjs/toolkit',
  ];

  let allDepsExist = true;
  for (const dep of criticalDeps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      printSuccess(`${dep} 已安装`);
    } else {
      printError(`${dep} 未安装`);
      allDepsExist = false;
    }
  }

  return allDepsExist;
}

// 检查 Android local.properties
function checkLocalProperties() {
  printHeader('检查 Android 配置');

  const localPropsFiles = [
    '3-adapter/android/IMPos2AdapterV1/android/local.properties',
    '4-assembly/android/IMPos2DesktopV1/android/local.properties',
  ];

  let allExist = true;
  for (const file of localPropsFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      printSuccess(`${file} 存在`);
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('sdk.dir=')) {
        printSuccess('  - sdk.dir 已配置');
      } else {
        printWarning('  - sdk.dir 未配置');
      }
    } else {
      printWarning(`${file} 不存在`);
      allExist = false;
    }
  }

  if (!allExist && !process.env.ANDROID_HOME) {
    printInfo('如果 ANDROID_HOME 已设置，可以忽略此警告');
  }

  return true; // 不强制要求
}

// 检查 Git 配置
function checkGit() {
  printHeader('检查 Git 配置');

  if (!commandExists('git')) {
    printWarning('Git 未安装');
    return false;
  }

  const gitVersion = execCommand('git --version');
  printSuccess(`Git 版本: ${gitVersion}`);

  // 检查是否在 Git 仓库中
  const isGitRepo = execCommand('git rev-parse --is-inside-work-tree 2>/dev/null');
  if (isGitRepo === 'true') {
    printSuccess('当前目录是 Git 仓库');

    const branch = execCommand('git branch --show-current');
    printInfo(`当前分支: ${branch}`);
  } else {
    printWarning('当前目录不是 Git 仓库');
  }

  return true;
}

// 检查系统信息
function checkSystem() {
  printHeader('系统信息');

  printInfo(`操作系统: ${os.platform()} ${os.release()}`);
  printInfo(`架构: ${os.arch()}`);
  printInfo(`CPU 核心数: ${os.cpus().length}`);
  printInfo(`总内存: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
  printInfo(`可用内存: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`);

  return true;
}

// 主函数
function main() {
  console.clear();
  console.log('');
  console.log(`${colors.green}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.green}║   IMPos2 环境检查工具                 ║${colors.reset}`);
  console.log(`${colors.green}╚════════════════════════════════════════╝${colors.reset}`);
  console.log('');

  const results = {
    node: checkNode(),
    yarn: checkYarn(),
    java: checkJava(),
    androidSDK: checkAndroidSDK(),
    dependencies: checkDependencies(),
    localProperties: checkLocalProperties(),
    git: checkGit(),
    system: checkSystem(),
  };

  // 总结
  printHeader('检查总结');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  console.log('');
  if (passed === total) {
    printSuccess(`所有检查通过 (${passed}/${total})`);
    console.log('');
    console.log(`${colors.green}✓ 环境配置完整，可以开始开发！${colors.reset}`);
  } else {
    printWarning(`部分检查未通过 (${passed}/${total})`);
    console.log('');
    console.log(`${colors.yellow}! 请根据上述提示修复问题${colors.reset}`);
  }

  console.log('');

  // 返回退出码
  process.exit(passed === total ? 0 : 1);
}

// 运行主函数
main();
