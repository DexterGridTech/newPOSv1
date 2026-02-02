export const getObjectChanges = (prev: any, curr: any): Record<string, any> => {
    const changes: Record<string, any> = {};

    // 1. 收集所有需要对比的属性（包含prev和curr的所有键）
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);

    // 2. 遍历所有属性，对比值是否变化
    allKeys.forEach(key => {
        const prevValue = prev[key];
        const currValue = curr[key];

        if (prevValue !== currValue) {
            changes[key] = currValue;
        }
    });

    return changes;
}