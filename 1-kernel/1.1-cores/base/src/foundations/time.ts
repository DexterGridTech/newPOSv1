import {format} from 'date-fns';

/**
 * 格式化当前时间
 * @returns 格式化后的时间字符串，格式：yyyy-M-d HH:mm:ss SSS
 */
export const formattedTime = (): string => {
    const now = new Date();
    // date-fns格式符说明：
    // yyyy=四位年，M=月份（不带前导零），d=日期（不带前导零）
    // HH=24小时制两位，mm=分钟两位，ss=秒两位，SSS=毫秒三位
    return format(now, 'yyyy-M-d HH:mm:ss SSS');
};
