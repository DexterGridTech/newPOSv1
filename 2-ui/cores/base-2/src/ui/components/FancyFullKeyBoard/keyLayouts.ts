/**
 * 键盘布局配置
 */

export type KeyType = 'letter' | 'number' | 'symbol' | 'function';

export interface KeyConfig {
    label: string;
    value: string;
    type: KeyType;
    flex?: number;
}

/**
 * 全键盘布局 - 字母模式（小写）
 */
export const FULL_KEYBOARD_LOWERCASE: KeyConfig[][] = [
    [
        {label: '1', value: '1', type: 'number'},
        {label: '2', value: '2', type: 'number'},
        {label: '3', value: '3', type: 'number'},
        {label: '4', value: '4', type: 'number'},
        {label: '5', value: '5', type: 'number'},
        {label: '6', value: '6', type: 'number'},
        {label: '7', value: '7', type: 'number'},
        {label: '8', value: '8', type: 'number'},
        {label: '9', value: '9', type: 'number'},
        {label: '0', value: '0', type: 'number'},
    ],
    [
        {label: 'q', value: 'q', type: 'letter'},
        {label: 'w', value: 'w', type: 'letter'},
        {label: 'e', value: 'e', type: 'letter'},
        {label: 'r', value: 'r', type: 'letter'},
        {label: 't', value: 't', type: 'letter'},
        {label: 'y', value: 'y', type: 'letter'},
        {label: 'u', value: 'u', type: 'letter'},
        {label: 'i', value: 'i', type: 'letter'},
        {label: 'o', value: 'o', type: 'letter'},
        {label: 'p', value: 'p', type: 'letter'},
    ],
    [
        {label: 'a', value: 'a', type: 'letter'},
        {label: 's', value: 's', type: 'letter'},
        {label: 'd', value: 'd', type: 'letter'},
        {label: 'f', value: 'f', type: 'letter'},
        {label: 'g', value: 'g', type: 'letter'},
        {label: 'h', value: 'h', type: 'letter'},
        {label: 'j', value: 'j', type: 'letter'},
        {label: 'k', value: 'k', type: 'letter'},
        {label: 'l', value: 'l', type: 'letter'},
    ],
    [
        {label: '⇧', value: 'SHIFT', type: 'function', flex: 1.5},
        {label: 'z', value: 'z', type: 'letter'},
        {label: 'x', value: 'x', type: 'letter'},
        {label: 'c', value: 'c', type: 'letter'},
        {label: 'v', value: 'v', type: 'letter'},
        {label: 'b', value: 'b', type: 'letter'},
        {label: 'n', value: 'n', type: 'letter'},
        {label: 'm', value: 'm', type: 'letter'},
        {label: '⌫', value: 'DELETE', type: 'function', flex: 1.5},
    ],
    [
        {label: '@', value: '@', type: 'symbol'},
        {label: '-', value: '-', type: 'symbol'},
        {label: '_', value: '_', type: 'symbol'},
        {label: '空格', value: ' ', type: 'symbol', flex: 4},
        {label: '.', value: '.', type: 'symbol'},
    ],
];

/**
 * 全键盘布局 - 字母模式（大写）
 */
export const FULL_KEYBOARD_UPPERCASE: KeyConfig[][] = FULL_KEYBOARD_LOWERCASE.map((row) =>
    row.map((key) => {
        if (key.type === 'letter') {
            return {
                ...key,
                label: key.label.toUpperCase(),
                value: key.value.toUpperCase(),
            };
        }
        return key;
    })
);
