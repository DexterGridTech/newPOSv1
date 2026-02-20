/**
 * 需要持久化的 state 键列表
 */
const statesNeedToPersist: string[] = [];

/**
 * 需要同步到 slave 的 state 键列表
 */
const statesNeedToSync: string[] = [];

/**
 * 注册需要持久化的 state
 * @param stateName state 名称
 * @throws 如果 state 名称已存在则抛出错误
 */
export function registerStateToPersist(stateName: string): void {
    if (statesNeedToPersist.includes(stateName)) {
        throw new Error(`State "${stateName}" is already registered for persistence`);
    }
    statesNeedToPersist.push(stateName);
}

/**
 * 注册需要同步到 slave 的 state
 * @param stateName state 名称
 * @throws 如果 state 名称已存在则抛出错误
 */
export function registerStateToSync(stateName: string): void {
    if (statesNeedToSync.includes(stateName)) {
        throw new Error(`State "${stateName}" is already registered for sync`);
    }
    statesNeedToSync.push(stateName);
}

/**
 * 获取需要持久化的 state 列表（只读）
 */
export function getStatesToPersist(): readonly string[] {
    return statesNeedToPersist;
}

/**
 * 获取需要同步的 state 列表（只读）
 */
export function getStatesToSync(): readonly string[] {
    return statesNeedToSync;
}
