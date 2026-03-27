const fs = require('fs');
const path = require('path');

// 复制 TemplateEngine 类
function kebabToPascal(str) {
  return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

function kebabToDot(str) {
  return str.replace(/-/g, '.');
}

class TemplateEngine {
  constructor(config, packageType, packageName) {
    this.config = config;
    this.packageType = packageType;
    this.packageName = packageName;
    this.variables = this.buildVariables();
  }

  buildVariables() {
    const vars = {};
    const typeConfig = this.config.types[this.packageType];
    Object.assign(vars, typeConfig);
    vars.PACKAGE_NAME = this.packageName;

    const varConfig = this.config.variables;
    for (const [key, config] of Object.entries(varConfig)) {
      if (config.transform) {
        if (config.transform === 'kebabToPascal') {
          vars[key] = kebabToPascal(this.packageName);
        } else if (config.transform === 'kebabToDot') {
          vars[key] = kebabToDot(this.packageName);
        }
      } else if (config.template) {
        vars[key] = this.resolveTemplate(config.template, vars);
      }
    }
    return vars;
  }

  resolveTemplate(template, vars) {
    let result = template;
    const regex = /\{\{([A-Z_]+)\}\}/g;
    let match;
    let maxIterations = 10;
    while ((match = regex.exec(result)) !== null && maxIterations-- > 0) {
      const varName = match[1];
      if (vars[varName] !== undefined) {
        result = result.replace(match[0], vars[varName]);
      }
      regex.lastIndex = 0;
    }
    return result;
  }

  replaceContent(content) {
    let result = content;
    const sortedVars = Object.entries(this.variables).sort((a, b) => b[0].length - a[0].length);
    for (const [key, value] of sortedVars) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }
}

// 测试
const config = JSON.parse(fs.readFileSync('_package_template_/template.config.json', 'utf8'));
const engine = new TemplateEngine(config, 'kernel', 'test-demo');

console.log('=== 变量映射 ===');
console.log(JSON.stringify(engine.variables, null, 2));

console.log('\n=== 模板替换测试 ===');
const testContent = `
export const moduleName = '{{MODULE_NAME}}'
export const packageName = '{{PACKAGE_FULL_NAME}}'
export const description = '{{PACKAGE_DESCRIPTION}}'
export const PascalName = {{PACKAGE_NAME_PASCAL}}
`;

console.log('替换后:');
console.log(engine.replaceContent(testContent));
