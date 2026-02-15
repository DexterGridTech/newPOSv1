

/**
 * 初始化日志工具类
 */
export class InitLogger {
    private static readonly COLORS = {
        RESET: '\x1b[0m',
        BRIGHT: '\x1b[1m',
        CYAN: '\x1b[36m',
        GREEN: '\x1b[32m',
        BLUE: '\x1b[34m',
        MAGENTA: '\x1b[35m',
        WHITE: '\x1b[37m',
        DIM: '\x1b[2m',
    };

    private startTime: number = 0;

    private colorize(text: string, color: keyof typeof InitLogger.COLORS, style?: keyof typeof InitLogger.COLORS): string {
        const colorCode = InitLogger.COLORS[color];
        const styleCode = style ? InitLogger.COLORS[style] : '';
        const reset = InitLogger.COLORS.RESET;
        return `${styleCode}${colorCode}${text}${reset}`;
    }

    logBanner(): void {
        const banner = `
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║    🖥️  IMPOS2 System With Refined Architecture                       ║
║    👨🏻 Designed By Dexter assisted by ClaudeCode                     ║
║     🚀  Application Initializing                                      ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
        `;
        console.log(this.colorize(banner, 'CYAN', 'BRIGHT'));
        this.startTime = Date.now();
    }

    logStep(step: number, title: string): void {
        const stepText = `\n┌─ Step ${step}: ${title}`;
        console.log(this.colorize(stepText, 'BLUE', 'BRIGHT'));
        console.log(this.colorize('│', 'BLUE'));
    }

    logStepEnd(): void {
        console.log(this.colorize('└─ ✓ Completed\n', 'GREEN'));
    }

    logDetail(label: string, value: string | number | boolean): void {
        const formattedLabel = this.colorize(`│  ├─ ${label}:`, 'CYAN');
        const formattedValue = this.colorize(` ${value}`, 'WHITE');
        console.log(formattedLabel + formattedValue);
    }

    logModule(module: any, index: number, total: number): void {
        const moduleHeader = `│  ├─ [${index + 1}/${total}] ${module.name}`;
        console.log(this.colorize(moduleHeader, 'MAGENTA', 'BRIGHT'));

        const actorCount = Object.keys(module.actors || {}).length;
        const commandCount = Object.keys(module.commands || {}).length;
        const sliceCount = Object.keys(module.slices || {}).length;
        const epicCount = Object.keys(module.epics || {}).length;
        const errorCount = Object.keys(module.errorMessages || {}).length;
        const paramCount = Object.keys(module.parameters || {}).length;

        console.log(this.colorize(`│  │  ├─ Actors: ${actorCount}`, actorCount > 0 ? 'CYAN' : 'WHITE'));
        console.log(this.colorize(`│  │  ├─ Commands: ${commandCount}`, commandCount > 0 ? 'CYAN' : 'WHITE'));
        console.log(this.colorize(`│  │  ├─ Slices: ${sliceCount}`, sliceCount > 0 ? 'CYAN' : 'WHITE'));
        console.log(this.colorize(`│  │  ├─ Epics: ${epicCount}`, epicCount > 0 ? 'CYAN' : 'WHITE'));
        console.log(this.colorize(`│  │  ├─ ErrorMessages: ${errorCount}`, errorCount > 0 ? 'CYAN' : 'WHITE'));
        console.log(this.colorize(`│  │  └─ Parameters: ${paramCount}`, paramCount > 0 ? 'CYAN' : 'WHITE'));
    }

    logNames(names: string[]): void {
        names.forEach(name => {
            console.log(this.colorize(`│  │  · ${name}`, 'DIM'));
        });
    }

    logSuccess(message: string): void {
        console.log(this.colorize(`│  ✓ ${message}`, 'GREEN'));
    }

    logSummary(allModules: any[]): void {
        const elapsed = Date.now() - this.startTime;
        const totalActors = allModules.reduce((sum, m) => sum + Object.keys(m.actors || {}).length, 0);
        const totalCommands = allModules.reduce((sum, m) => sum + Object.keys(m.commands || {}).length, 0);
        const totalSlices = allModules.reduce((sum, m) => sum + Object.keys(m.slices || {}).length, 0);
        const totalEpics = allModules.reduce((sum, m) => sum + Object.keys(m.epics || {}).length, 0);

        // 直接使用固定格式，手动对齐
        const summary = `
╔═══════════════════════════════════════════════════════════════════════╗
║  📊 Initialization Summary                                           ║
╠═══════════════════════════════════════════════════════════════════════╣
║  ✓ Total Modules:      ${String(allModules.length).padEnd(46)}║
║  ✓ Total Actors:       ${String(totalActors).padEnd(46)}║
║  ✓ Total Commands:     ${String(totalCommands).padEnd(46)}║
║  ✓ Total Slices:       ${String(totalSlices).padEnd(46)}║
║  ✓ Total Epics:        ${String(totalEpics).padEnd(46)}║
║  ⏱️  Time Elapsed:      ${String(elapsed + 'ms').padEnd(46)}║
╚═══════════════════════════════════════════════════════════════════════╝
        `;
        console.log(this.colorize(summary, 'GREEN', 'BRIGHT'));
    }

    private formatSummaryLine(label: string, value: string): string {
        // 表格总宽度是 71 个字符（从 ║ 到 ║）
        // 格式：║  ✓ label value                                              ║
        const prefix = '║  ✓ ';
        const suffix = '║';

        // 计算实际显示宽度
        // ║ = 1, 空格 = 1, 空格 = 1, ✓ = 1, 空格 = 1 = 总共 5
        // 结尾 ║ = 1
        // 中间内容区域 = 71 - 5 - 1 = 65

        const content = `${label} ${value}`;
        const contentWidth = 65;
        const padding = ' '.repeat(Math.max(0, contentWidth - content.length));

        return `${prefix}${content}${padding}${suffix}`;
    }

    private padRight(text: string, width: number): string {
        return text + ' '.repeat(Math.max(0, width - text.length));
    }
}
