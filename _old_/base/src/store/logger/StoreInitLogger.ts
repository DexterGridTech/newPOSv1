import { KernelModule } from "../types";
import {now} from 'lodash';


/**
 * Store 初始化日志工具
 * 职责: 负责美化输出 Store 初始化过程的日志
 */
export class StoreInitLogger {
    private static readonly COLORS = {
        RESET: '\x1b[0m',
        BRIGHT: '\x1b[1m',
        DIM: '\x1b[2m',

        // 前景色
        BLACK: '\x1b[30m',
        RED: '\x1b[31m',
        GREEN: '\x1b[32m',
        YELLOW: '\x1b[33m',
        BLUE: '\x1b[34m',
        MAGENTA: '\x1b[35m',
        CYAN: '\x1b[36m',
        WHITE: '\x1b[37m',

        // 背景色
        BG_BLACK: '\x1b[40m',
        BG_RED: '\x1b[41m',
        BG_GREEN: '\x1b[42m',
        BG_YELLOW: '\x1b[43m',
        BG_BLUE: '\x1b[44m',
        BG_MAGENTA: '\x1b[45m',
        BG_CYAN: '\x1b[46m',
        BG_WHITE: '\x1b[47m',
    };

    private startTime: number = 0;

    /**
     * 打印标题横幅
     */
    logBanner(): void {
        const banner = `
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║     🚀  IMPos2 Store Initialization                                  ║
║     📦  Kernel Module System                                         ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
        `;
        console.log(this.colorize(banner, 'CYAN', 'BRIGHT'));
        this.startTime = now();
    }

    /**
     * 打印步骤标题
     */
    logStep(step: number, title: string): void {
        const stepText = `\n┌─ Step ${step}: ${title}`;
        console.log(this.colorize(stepText, 'BLUE', 'BRIGHT'));
        console.log(this.colorize('│', 'BLUE'));
    }

    /**
     * 打印步骤结束
     */
    logStepEnd(): void {
        console.log(this.colorize('└─ ✓ Completed\n', 'GREEN'));
    }

    /**
     * 打印详细信息
     */
    logDetail(label: string, value: string | number | boolean): void {
        const formattedLabel = this.colorize(`│  ├─ ${label}:`, 'CYAN');
        const formattedValue = this.colorize(` ${value}`, 'WHITE');
        console.log(formattedLabel + formattedValue);
    }

    /**
     * 打印列表项
     */
    logListItem(item: string, index?: number): void {
        const prefix = index !== undefined ? `│  │  ${index + 1}.` : '│  │  •';
        console.log(this.colorize(`${prefix} ${item}`, 'WHITE'));
    }

    /**
     * 打印模块信息
     */
    logModule(module: KernelModule, index: number, total: number): void {
        // 模块名称
        const moduleName = module.name || `Anonymous Module`;
        const moduleHeader = `│  ├─ [${index + 1}/${total}] ${moduleName}`;
        console.log(this.colorize(moduleHeader, 'MAGENTA', 'BRIGHT'));

        // 统计信息
        const reducerCount = Object.keys(module.reducers || {}).length;
        const reducerKeys = Object.keys(module.reducers || {});
        const epicCount = module.epics?.length || 0;
        const actorCount = module.actors?.length || 0;
        const screenPartCount = module.screenParts?.length || 0;
        const dependencyCount = module.dependencies?.length || 0;

        // 打印 Reducers 及其 keys
        if (reducerCount > 0) {
            console.log(this.colorize(`│  │  ├─ Reducers: ${reducerCount}`, 'CYAN'));
            reducerKeys.forEach((key, idx) => {
                const isLast = idx === reducerKeys.length - 1 && epicCount === 0 && actorCount === 0 && screenPartCount === 0 && dependencyCount === 0;
                const prefix = isLast ? '└' : '├';
                console.log(this.colorize(`│  │  │  ${prefix}─ ${key}`, 'WHITE', 'DIM'));
            });
        } else {
            console.log(this.colorize(`│  │  ├─ Reducers: 0`, 'WHITE', 'DIM'));
        }

        // 打印 Epics
        console.log(this.colorize(`│  │  ├─ Epics: ${epicCount}`, epicCount > 0 ? 'CYAN' : 'WHITE'));

        // 打印 Actors
        console.log(this.colorize(`│  │  ├─ Actors: ${actorCount}`, actorCount > 0 ? 'CYAN' : 'WHITE'));

        // 打印 ScreenParts 及其详细信息
        if (screenPartCount > 0) {
            console.log(this.colorize(`│  │  ├─ ScreenParts: ${screenPartCount}`, 'CYAN'));
            module.screenParts?.forEach((screenPart, idx) => {
                const isLast = idx === screenPartCount - 1 && dependencyCount === 0;
                const prefix = isLast ? '└' : '├';
                const containerInfo = screenPart.containerKey ? ` (container: ${screenPart.containerKey})` : '';
                console.log(this.colorize(`│  │  │  ${prefix}─ ${screenPart.partKey}${containerInfo}`, 'WHITE', 'DIM'));
            });
        } else {
            console.log(this.colorize(`│  │  ├─ ScreenParts: 0`, 'WHITE', 'DIM'));
        }

        // 打印 Dependencies
        const depPrefix = '└';
        console.log(this.colorize(`│  │  ${depPrefix}─ Dependencies: ${dependencyCount}`, dependencyCount > 0 ? 'CYAN' : 'WHITE'));
    }

    /**
     * 打印警告信息
     */
    logWarning(message: string): void {
        console.log(this.colorize(`│  ⚠️  ${message}`, 'YELLOW'));
    }

    /**
     * 打印成功信息
     */
    logSuccess(message: string): void {
        console.log(this.colorize(`│  ✓ ${message}`, 'GREEN'));
    }

    /**
     * 打印错误信息
     */
    logError(message: string): void {
        console.log(this.colorize(`│  ✗ ${message}`, 'RED', 'BRIGHT'));
    }

    /**
     * 打印总结信息
     */
    logSummary(resolvedModules: KernelModule[]): void {
        const elapsed = now() - this.startTime;
        const totalReducers = resolvedModules.reduce((sum, m) => sum + Object.keys(m.reducers || {}).length, 0);
        const totalEpics = resolvedModules.reduce((sum, m) => sum + (m.epics?.length || 0), 0);
        const totalActors = resolvedModules.reduce((sum, m) => sum + (m.actors?.length || 0), 0);
        const totalScreenParts = resolvedModules.reduce((sum, m) => sum + (m.screenParts?.length || 0), 0);

        const summary = `
╔═══════════════════════════════════════════════════════════════════════╗
║  📊 Initialization Summary                                           ║
╠═══════════════════════════════════════════════════════════════════════╣
║  ✓ Total Modules:      ${this.padRight(resolvedModules.length.toString(), 48)}║
║  ✓ Total Reducers:     ${this.padRight(totalReducers.toString(), 48)}║
║  ✓ Total Epics:        ${this.padRight(totalEpics.toString(), 48)}║
║  ✓ Total Actors:       ${this.padRight(totalActors.toString(), 48)}║
║  ✓ Total ScreenParts:  ${this.padRight(totalScreenParts.toString(), 48)}║
║  ⏱️  Time Elapsed:      ${this.padRight(`${elapsed}ms`, 48)}║
╚═══════════════════════════════════════════════════════════════════════╝
        `;
        console.log(this.colorize(summary, 'GREEN', 'BRIGHT'));
    }

    /**
     * 颜色化文本
     */
    private colorize(text: string, color: keyof typeof StoreInitLogger.COLORS, style?: keyof typeof StoreInitLogger.COLORS): string {
        const colorCode = StoreInitLogger.COLORS[color];
        const styleCode = style ? StoreInitLogger.COLORS[style] : '';
        const reset = StoreInitLogger.COLORS.RESET;
        return `${styleCode}${colorCode}${text}${reset}`;
    }

    /**
     * 右对齐填充
     */
    private padRight(text: string, width: number): string {
        return text + ' '.repeat(Math.max(0, width - text.length));
    }
}
