#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ==================== 工具函数 ====================

// 将 kebab-case 转换为 PascalCase
function kebabToPascal(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// 将 kebab-case 转换为 dot.case
function kebabToDot(str) {
  return str.replace(/-/g, '.');
}

// 验证包名格式
function validatePackageName(name) {
  const regex = /^[a-z]+(-[a-z]+)*$/;
  return regex.test(name);
}

// 提问函数
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ==================== 模板引擎 ====================

class TemplateEngine {
  constructor(config, packageType, packageName) {
    this.config = config;
    this.packageType = packageType;
    this.packageName = packageName;
    this.variables = this.buildVariables();
  }

  // 构建所有变量
  buildVariables() {
    const vars = {};
    const typeConfig = this.config.types[this.packageType];

    // 添加类型相关变量
    Object.assign(vars, typeConfig);

    // 添加基础变量
    vars.PACKAGE_NAME = this.packageName;

    // 处理需要转换的变量
    const varConfig = this.config.variables;
    for (const [key, config] of Object.entries(varConfig)) {
      if (config.transform) {
        // 应用转换函数
        if (config.transform === 'kebabToPascal') {
          vars[key] = kebabToPascal(this.packageName);
        } else if (config.transform === 'kebabToDot') {
          vars[key] = kebabToDot(this.packageName);
        }
      } else if (config.template) {
        // 递归解析模板
        vars[key] = this.resolveTemplate(config.template, vars);
      }
    }

    return vars;
  }

  // 解析模板字符串
  resolveTemplate(template, vars) {
    let result = template;
    const regex = /\{\{([A-Z_]+)\}\}/g;
    let match;

    // 多次迭代直到没有变量需要替换
    let maxIterations = 10;
    while ((match = regex.exec(result)) !== null && maxIterations-- > 0) {
      const varName = match[1];
      if (vars[varName] !== undefined) {
        result = result.replace(match[0], vars[varName]);
      }
      regex.lastIndex = 0; // 重置正则
    }

    return result;
  }

  // 替换文件内容
  replaceContent(content) {
    let result = content;

    // 按变量名长度降序排序，避免短变量名覆盖长变量名
    const sortedVars = Object.entries(this.variables)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [key, value] of sortedVars) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  // 获取变量信息（用于显示）
  getVariableInfo() {
    return this.variables;
  }
}

// ==================== 文件操作 ====================

// 递归复制目录并替换模板变量
function copyDirectory(src, dest, engine) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, engine);
    } else {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = engine.replaceContent(content);
      fs.writeFileSync(destPath, content, 'utf8');
    }
  }
}

// ==================== 主流程 ====================

async function main() {
  try {
    console.log('=== 包生成脚本 ===\n');

    // 加载配置
    const configPath = path.join(__dirname, '../_package_template_/template.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // 1. 选择包类型
    console.log('请选择包类型:');
    console.log('1. Kernel 层包');
    console.log('2. UI 层包');
    const typeChoice = await question('\n请输入选项 (1 或 2): ');

    let packageType, templateDir, targetDir;

    if (typeChoice === '1') {
      packageType = 'kernel';
      templateDir = path.join(__dirname, '../_package_template_/kernel-template');
      targetDir = path.join(__dirname, '../1-kernel/1.2-modules');
    } else if (typeChoice === '2') {
      packageType = 'ui';
      templateDir = path.join(__dirname, '../_package_template_/ui-template');
      targetDir = path.join(__dirname, '../2-ui/2.2-modules');
    } else {
      console.error('❌ 无效的选项，请输入 1 或 2');
      rl.close();
      process.exit(1);
    }

    // 2. 输入包名
    console.log(`\n请输入包名 (格式: abc-def, 只能包含小写字母和减号):`);
    console.log(`完整包名将是: @impos2/${packageType}-[你的输入]`);
    const packageName = await question('\n包名: ');

    // 3. 验证包名格式
    if (!validatePackageName(packageName)) {
      console.error('❌ 包名格式不正确！只能包含小写字母和减号，如: abc-def');
      rl.close();
      process.exit(1);
    }

    // 4. 检查目录是否已存在
    const newPackageDir = path.join(targetDir, packageName);
    if (fs.existsSync(newPackageDir)) {
      console.error(`❌ 目录已存在: ${newPackageDir}`);
      rl.close();
      process.exit(1);
    }

    // 5. 创建模板引擎
    const engine = new TemplateEngine(config, packageType, packageName);
    const vars = engine.getVariableInfo();

    // 6. 显示生成信息
    console.log('\n=== 生成信息 ===');
    console.log(`包类型: ${vars.PACKAGE_TYPE_DISPLAY} 层`);
    console.log(`包名: ${vars.PACKAGE_FULL_NAME}`);
    console.log(`目录: ${packageName}`);
    console.log(`模块名: ${vars.MODULE_NAME}`);
    console.log(`PascalCase: ${vars.PACKAGE_NAME_PASCAL}`);
    console.log(`描述: ${vars.PACKAGE_DESCRIPTION}`);
    console.log(`目标路径: ${newPackageDir}`);

    const confirm = await question('\n确认生成? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ 已取消');
      rl.close();
      process.exit(0);
    }

    // 7. 复制模板并替换
    console.log('\n📦 正在生成包...');
    copyDirectory(templateDir, newPackageDir, engine);

    console.log('✅ 包生成成功！');
    console.log(`\n📁 包位置: ${newPackageDir}`);
    console.log(`📦 包名: ${vars.PACKAGE_FULL_NAME}`);
    console.log(`\n下一步:`);
    console.log(`1. cd ${newPackageDir}`);
    console.log(`2. 开始开发你的模块`);
    console.log(`3. 按需完善 test 入口和公开导出边界`);
    console.log(`4. 运行 yarn install 安装依赖`);

    rl.close();
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    console.error(error.stack);
    rl.close();
    process.exit(1);
  }
}

main();
