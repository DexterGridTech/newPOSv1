#!/usr/bin/env node

import { execSync } from 'child_process';
import readline from 'readline';

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 打印带颜色的文本
function print(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

// 打印分隔线
function printSeparator() {
  print('═'.repeat(60), 'cyan');
}

// 打印标题
function printTitle(title) {
  printSeparator();
  print(`  ${title}`, 'bright');
  printSeparator();
}

// 检查端口是否被占用
function checkPort(port) {
  try {
    // 使用 lsof 的完整路径查找占用端口的进程
    const result = execSync(`/usr/sbin/lsof -i :${port} -t`, { encoding: 'utf-8' }).trim();
    return result ? result.split('\n') : [];
  } catch (error) {
    return [];
  }
}

// 获取进程详细信息
function getProcessInfo(pid) {
  try {
    const info = execSync(`ps -p ${pid} -o pid,comm,args`, { encoding: 'utf-8' });
    return info.split('\n')[1]?.trim() || '';
  } catch (error) {
    return '';
  }
}

// 杀死进程
function killProcess(pid) {
  try {
    execSync(`kill -9 ${pid}`);
    return true;
  } catch (error) {
    return false;
  }
}

// 显示进程信息
function displayProcessInfo(port, pids) {
  print(`\n📍 端口 ${port} 被以下进程占用:\n`, 'yellow');

  pids.forEach((pid, index) => {
    const info = getProcessInfo(pid);
    print(`  ${index + 1}. PID: ${pid}`, 'magenta');
    if (info) {
      print(`     进程信息: ${info}`, 'blue');
    }
  });
  print('');
}

// 询问用户确认
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// 主函数
async function main() {
  printTitle('🔧 端口检查和清理工具');

  // 获取端口号
  let port = process.argv[2];

  if (!port) {
    print('\n请输入要检查的端口号:', 'cyan');
    port = await askQuestion('端口号: ');
  }

  // 验证端口号
  port = parseInt(port);
  if (isNaN(port) || port < 1 || port > 65535) {
    print('\n❌ 无效的端口号！端口号必须在 1-65535 之间。\n', 'red');
    process.exit(1);
  }

  print(`\n🔍 正在检查端口 ${port}...\n`, 'cyan');

  // 检查端口
  const pids = checkPort(port);

  if (pids.length === 0) {
    print(`✅ 端口 ${port} 未被占用，可以正常使用。\n`, 'green');
    printSeparator();
    process.exit(0);
  }

  // 显示进程信息
  displayProcessInfo(port, pids);

  // 询问是否杀死进程
  const answer = await askQuestion('是否要杀死这些进程？(y/n): ');

  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    print('\n❌ 操作已取消。\n', 'yellow');
    printSeparator();
    process.exit(0);
  }

  // 杀死进程
  print('\n⚡ 正在杀死进程...\n', 'cyan');

  let successCount = 0;
  let failCount = 0;

  for (const pid of pids) {
    const success = killProcess(pid);
    if (success) {
      print(`  ✅ 成功杀死进程 PID: ${pid}`, 'green');
      successCount++;
    } else {
      print(`  ❌ 无法杀死进程 PID: ${pid}`, 'red');
      failCount++;
    }
  }

  // 显示结果
  print('');
  printSeparator();
  print(`\n📊 执行结果:`, 'bright');
  print(`  成功: ${successCount} 个进程`, 'green');
  if (failCount > 0) {
    print(`  失败: ${failCount} 个进程`, 'red');
  }
  print('');
  printSeparator();
}

// 运行主函数
main().catch((error) => {
  print(`\n❌ 发生错误: ${error.message}\n`, 'red');
  process.exit(1);
});

