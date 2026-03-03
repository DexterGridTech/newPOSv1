#!/usr/bin/env node

/**
 * 从模版创建模块脚本
 *
 * 功能：
 * 1. 读取 _package_template_ 中的所有模版
 * 2. 让用户选择模版
 * 3. 收集必要参数
 * 4. 选择依赖包
 * 5. 选择后续操作
 * 6. 创建新模块
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { execSync } = require('child_process');

// 项目根目录
const ROOT_DIR = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(ROOT_DIR, '_package_template_');

/**
 * 工具函数：递归复制目录
 */
function copyDirectory(src, dest, replacements) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        // 跳过 template.config.json
        if (entry.name === 'template.config.json') {
            continue;
        }

        // 替换文件名中的变量
        destPath = replaceVariables(destPath, replacements);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath, replacements);
        } else {
            copyFile(srcPath, destPath, replacements);
        }
    }
}

/**
 * 工具函数：复制文件并替换变量
 */
function copyFile(src, dest, replacements) {
    let content = fs.readFileSync(src, 'utf-8');
    content = replaceVariables(content, replacements);
    fs.writeFileSync(dest, content, 'utf-8');
}

/**
 * 工具函数：替换变量
 */
function replaceVariables(text, replacements) {
    let result = text;
    for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

/**
 * 工具函数：将连字符命名转换为驼峰命名
 * 例如: my-module -> myModule
 */
function toCamelCase(str) {
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * 工具函数：将连字符命名转换为帕斯卡命名（首字母大写的驼峰）
 * 例如: my-module -> MyModule, user-login -> UserLogin
 */
function toPascalCase(str) {
    const camelCase = toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * 工具函数：读取所有可用模版
 */
function getAvailableTemplates() {
    if (!fs.existsSync(TEMPLATE_DIR)) {
        console.error(`模版目录不存在: ${TEMPLATE_DIR}`);
        process.exit(1);
    }

    const templates = [];
    const entries = fs.readdirSync(TEMPLATE_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const configPath = path.join(TEMPLATE_DIR, entry.name, 'template.config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                templates.push({
                    name: entry.name,
                    config,
                });
            }
        }
    }

    return templates;
}

/**
 * 工具函数：获取所有可用的依赖包
 */
function getAvailablePackages() {
    const packages = {
        kernel: [],
        ui: [],
    };

    // 读取 1-kernel 层的包
    const kernelDir = path.join(ROOT_DIR, '1-kernel');
    if (fs.existsSync(kernelDir)) {
        const entries = fs.readdirSync(kernelDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const pkgPath = path.join(kernelDir, entry.name, 'package.json');
                if (fs.existsSync(pkgPath)) {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                    packages.kernel.push({
                        name: pkg.name,
                        description: pkg.description || '',
                    });
                }
            }
        }
    }

    // 读取 2-ui 层的包
    const uiDir = path.join(ROOT_DIR, '2-ui');
    const uiSubDirs = ['cores', 'modules'];
    for (const subDir of uiSubDirs) {
        const dir = path.join(uiDir, subDir);
        if (fs.existsSync(dir)) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const pkgPath = path.join(dir, entry.name, 'package.json');
                    if (fs.existsSync(pkgPath)) {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                        packages.ui.push({
                            name: pkg.name,
                            description: pkg.description || '',
                        });
                    }
                }
            }
        }
    }

    return packages;
}

/**
 * 主函数
 */
async function main() {
    console.log('='.repeat(60));
    console.log('从模版创建模块');
    console.log('='.repeat(60));
    console.log('');

    // 1. 获取所有可用模版
    const templates = getAvailableTemplates();
    if (templates.length === 0) {
        console.error('没有找到可用的模版');
        process.exit(1);
    }

    // 2. 让用户选择模版
    const { selectedTemplate } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedTemplate',
            message: '请选择模版:',
            choices: templates.map(t => ({
                name: `${t.config.displayName} - ${t.config.description}`,
                value: t.name,
            })),
        },
    ]);

    const template = templates.find(t => t.name === selectedTemplate);
    const config = template.config;

    console.log('');
    console.log(`已选择模版: ${config.displayName}`);
    console.log('');

    // 3. 收集变量参数
    const variableAnswers = {};
    for (const variable of config.variables) {
        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: variable.name,
                message: `${variable.displayName} (${variable.description}):`,
                default: variable.default,
                validate: (input) => {
                    if (variable.required && !input) {
                        return `${variable.displayName} 是必填项`;
                    }
                    return true;
                },
            },
        ]);
        variableAnswers[variable.name] = answer[variable.name];
    }

    // 自动生成 fullPackageName 和 moduleName
    variableAnswers.fullPackageName = `@impos2/ui-module-${variableAnswers.packageName}`;
    variableAnswers.moduleName = `ui-${variableAnswers.packageName}`;
    // 生成帕斯卡命名的变量名（用于 JavaScript/TypeScript 标识符，首字母大写）
    variableAnswers.packageNameCamel = toPascalCase(variableAnswers.packageName);
    // 添加模块导出前缀（如果模板配置中有定义）
    if (config.moduleExportPrefix) {
        variableAnswers.moduleExportPrefix = toCamelCase(config.moduleExportPrefix);
    } else {
        variableAnswers.moduleExportPrefix = '';
    }

    console.log('');
    console.log('变量参数:');
    for (const [key, value] of Object.entries(variableAnswers)) {
        console.log(`  ${key}: ${value}`);
    }
    console.log('');

    // 4. 选择依赖包
    const availablePackages = getAvailablePackages();

    const { selectedDependencies } = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selectedDependencies',
            message: '请选择依赖包 (使用空格选择，回车确认):',
            choices: [
                new inquirer.Separator('=== Kernel 层 ==='),
                ...availablePackages.kernel.map(pkg => ({
                    name: `${pkg.name} ${pkg.description ? `- ${pkg.description}` : ''}`,
                    value: pkg.name,
                    checked: config.dependencies.kernel.includes(pkg.name),
                })),
                new inquirer.Separator('=== UI 层 ==='),
                ...availablePackages.ui.map(pkg => ({
                    name: `${pkg.name} ${pkg.description ? `- ${pkg.description}` : ''}`,
                    value: pkg.name,
                    checked: config.dependencies.ui.includes(pkg.name),
                })),
            ],
        },
    ]);

    console.log('');
    console.log('已选择依赖包:');
    selectedDependencies.forEach(dep => console.log(`  - ${dep}`));
    console.log('');

    // 5. 选择后续操作
    // 根据模板配置过滤可用的操作
    const availableActions = config.postCreateActions.filter(action => {
        // 如果是 addToRootScripts 操作，检查模板是否需要启动脚本
        if (action.name === 'addToRootScripts') {
            return config.needsStartScript === true;
        }
        return true;
    });

    const { selectedActions } = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selectedActions',
            message: '请选择创建后的操作:',
            choices: availableActions.map(action => ({
                name: `${action.displayName} - ${action.description}`,
                value: action.name,
                checked: action.default,
            })),
        },
    ]);

    console.log('');
    console.log('已选择操作:');
    selectedActions.forEach(action => {
        const actionConfig = config.postCreateActions.find(a => a.name === action);
        console.log(`  - ${actionConfig.displayName}`);
    });
    console.log('');

    // 6. 确认创建
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: '确认创建模块?',
            default: true,
        },
    ]);

    if (!confirm) {
        console.log('已取消创建');
        process.exit(0);
    }

    console.log('');
    console.log('开始创建模块...');
    console.log('');

    // 7. 创建模块目录
    const targetDir = path.join(ROOT_DIR, config.targetLayer, variableAnswers.packageName);
    if (fs.existsSync(targetDir)) {
        console.error(`目标目录已存在: ${targetDir}`);
        process.exit(1);
    }

    console.log(`创建目录: ${targetDir}`);
    const templatePath = path.join(TEMPLATE_DIR, selectedTemplate);
    copyDirectory(templatePath, targetDir, variableAnswers);
    console.log('✓ 目录创建完成');
    console.log('');

    // 8. 更新 package.json 依赖
    console.log('更新 package.json 依赖...');
    const pkgPath = path.join(targetDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    // 添加选中的依赖
    for (const dep of selectedDependencies) {
        pkg.dependencies[dep] = '*';
    }

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8');
    console.log('✓ 依赖更新完成');
    console.log('');

    // 9. 执行后续操作
    if (selectedActions.includes('installDependencies')) {
        console.log('安装依赖...');
        try {
            execSync('yarn install', { cwd: ROOT_DIR, stdio: 'inherit' });
            console.log('✓ 依赖安装完成');
        } catch (error) {
            console.error('✗ 依赖安装失败:', error.message);
        }
        console.log('');
    }

    if (selectedActions.includes('addToRootScripts')) {
        console.log('添加到根目录脚本...');
        try {
            const rootPkgPath = path.join(ROOT_DIR, 'package.json');
            const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));

            if (!rootPkg.scripts) {
                rootPkg.scripts = {};
            }

            // 使用模板配置中的前缀
            const scriptPrefix = config.startScriptPrefix || 'dev';
            const scriptName = `${scriptPrefix}-${variableAnswers.packageName}`;
            rootPkg.scripts[scriptName] = `corepack yarn workspace ${variableAnswers.fullPackageName} web`;

            fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2), 'utf-8');
            console.log(`✓ 已添加脚本: ${scriptName}`);
        } catch (error) {
            console.error('✗ 添加脚本失败:', error.message);
        }
        console.log('');
    }

    // 10. 完成
    console.log('='.repeat(60));
    console.log('✓ 模块创建完成！');
    console.log('='.repeat(60));
    console.log('');
    console.log(`模块路径: ${targetDir}`);
    console.log(`包名: ${variableAnswers.fullPackageName}`);
    console.log('');
    console.log('下一步:');
    console.log(`  1. 进入模块目录: cd ${config.targetLayer}/${variableAnswers.packageName}`);
    console.log(`  2. 开始开发: yarn web`);
    if (selectedActions.includes('addToRootScripts')) {
        const scriptPrefix = config.startScriptPrefix || 'dev';
        const scriptName = `${scriptPrefix}-${variableAnswers.packageName}`;
        console.log(`  3. 或在根目录运行: yarn ${scriptName}`);
    }
    console.log('');
}

// 运行主函数
main().catch(error => {
    console.error('错误:', error);
    process.exit(1);
});
