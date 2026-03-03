#!/usr/bin/env node

/**
 * 安卓虚拟机端口映射脚本
 * 为安卓虚拟机设置端口转发，将主机端口映射到虚拟机
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ADB 路径配置
const ADB_PATH = '/Users/dexter/Library/Android/sdk/platform-tools/adb';

// 需要映射的端口列表
const PORTS_TO_FORWARD = [
  { host: 9999, device: 9999, description: 'Custom Service' },
  { host: 9090, device: 9090, description: 'Reactotron' }
];

/**
 * 检查 ADB 是否可用
 */
async function checkAdb() {
  try {
    const { stdout } = await execAsync(`${ADB_PATH} version`);
    console.log('✓ ADB 可用');
    console.log(stdout.split('\n')[0]);
    return true;
  } catch (error) {
    console.error('✗ ADB 不可用，请检查路径:', ADB_PATH);
    return false;
  }
}

/**
 * 获取连接的设备列表
 */
async function getDevices() {
  try {
    const { stdout } = await execAsync(`${ADB_PATH} devices`);
    const lines = stdout.split('\n').slice(1).filter(line => line.trim());
    const devices = lines
      .map(line => {
        const parts = line.split('\t');
        return parts.length === 2 ? { id: parts[0], status: parts[1] } : null;
      })
      .filter(device => device && device.status === 'device');

    return devices;
  } catch (error) {
    console.error('✗ 获取设备列表失败:', error.message);
    return [];
  }
}

/**
 * 为指定设备设置端口转发
 */
async function setupPortForwarding(deviceId, port) {
  try {
    const command = `${ADB_PATH} -s ${deviceId} reverse tcp:${port.device} tcp:${port.host}`;
    await execAsync(command);
    console.log(`  ✓ ${port.description}: ${port.host} -> ${port.device}`);
    return true;
  } catch (error) {
    console.error(`  ✗ 端口 ${port.host} 映射失败:`, error.message);
    return false;
  }
}

/**
 * 列出当前的端口转发规则
 */
async function listPortForwarding(deviceId) {
  try {
    const { stdout } = await execAsync(`${ADB_PATH} -s ${deviceId} reverse --list`);
    if (stdout.trim()) {
      console.log('\n当前端口转发规则:');
      console.log(stdout);
    } else {
      console.log('\n当前没有端口转发规则');
    }
  } catch (error) {
    console.error('✗ 获取端口转发规则失败:', error.message);
  }
}

/**
 * 清除所有端口转发规则
 */
async function clearPortForwarding(deviceId) {
  try {
    await execAsync(`${ADB_PATH} -s ${deviceId} reverse --remove-all`);
    console.log('✓ 已清除所有端口转发规则');
    return true;
  } catch (error) {
    console.error('✗ 清除端口转发规则失败:', error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('=== 安卓虚拟机端口映射设置 ===\n');

  // 检查 ADB
  const adbAvailable = await checkAdb();
  if (!adbAvailable) {
    process.exit(1);
  }

  // 获取设备列表
  console.log('\n正在检查连接的设备...');
  const devices = await getDevices();

  if (devices.length === 0) {
    console.error('✗ 没有找到连接的设备');
    console.log('\n请确保:');
    console.log('  1. 安卓虚拟机已启动');
    console.log('  2. USB 调试已开启');
    console.log('  3. 设备已通过 ADB 连接');
    process.exit(1);
  }

  console.log(`✓ 找到 ${devices.length} 个设备:\n`);
  devices.forEach((device, index) => {
    console.log(`  ${index + 1}. ${device.id}`);
  });

  // 为每个设备设置端口转发
  for (const device of devices) {
    console.log(`\n正在为设备 ${device.id} 设置端口转发...`);

    let successCount = 0;
    for (const port of PORTS_TO_FORWARD) {
      const success = await setupPortForwarding(device.id, port);
      if (success) successCount++;
    }

    console.log(`\n完成: ${successCount}/${PORTS_TO_FORWARD.length} 个端口映射成功`);

    // 列出当前的端口转发规则
    await listPortForwarding(device.id);
  }

  console.log('\n=== 设置完成 ===');
  console.log('\n提示:');
  console.log('  - 端口转发在设备重启后会失效，需要重新运行此脚本');
  console.log('  - 使用 "yarn android:port-clear" 可以清除所有端口转发规则');
}

// 处理命令行参数
const args = process.argv.slice(2);

if (args.includes('--clear') || args.includes('-c')) {
  // 清除模式
  (async () => {
    console.log('=== 清除端口转发规则 ===\n');

    const adbAvailable = await checkAdb();
    if (!adbAvailable) {
      process.exit(1);
    }

    const devices = await getDevices();
    if (devices.length === 0) {
      console.error('✗ 没有找到连接的设备');
      process.exit(1);
    }

    for (const device of devices) {
      console.log(`\n正在清除设备 ${device.id} 的端口转发规则...`);
      await clearPortForwarding(device.id);
    }

    console.log('\n=== 清除完成 ===');
  })();
} else if (args.includes('--list') || args.includes('-l')) {
  // 列出模式
  (async () => {
    console.log('=== 查看端口转发规则 ===\n');

    const adbAvailable = await checkAdb();
    if (!adbAvailable) {
      process.exit(1);
    }

    const devices = await getDevices();
    if (devices.length === 0) {
      console.error('✗ 没有找到连接的设备');
      process.exit(1);
    }

    for (const device of devices) {
      console.log(`\n设备: ${device.id}`);
      await listPortForwarding(device.id);
    }
  })();
} else if (args.includes('--help') || args.includes('-h')) {
  // 帮助信息
  console.log('安卓虚拟机端口映射脚本');
  console.log('\n用法:');
  console.log('  node setup-android-port-forwarding.js          设置端口转发');
  console.log('  node setup-android-port-forwarding.js --list   列出当前端口转发规则');
  console.log('  node setup-android-port-forwarding.js --clear  清除所有端口转发规则');
  console.log('  node setup-android-port-forwarding.js --help   显示帮助信息');
  console.log('\n选项:');
  console.log('  -l, --list    列出当前端口转发规则');
  console.log('  -c, --clear   清除所有端口转发规则');
  console.log('  -h, --help    显示帮助信息');
  console.log('\n端口映射列表:');
  PORTS_TO_FORWARD.forEach(port => {
    console.log(`  ${port.host} -> ${port.device}  (${port.description})`);
  });
} else {
  // 默认执行设置
  main().catch(error => {
    console.error('\n✗ 发生错误:', error.message);
    process.exit(1);
  });
}
