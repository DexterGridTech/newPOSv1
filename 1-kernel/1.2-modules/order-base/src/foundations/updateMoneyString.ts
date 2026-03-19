/**
 * 更新金额字符串（元），处理用户键盘输入
 * - 'b'：退格
 * - '.'：添加小数点（整数部分最多 8 位）
 * - '0'-'9'：追加数字（小数部分最多 2 位）
 */
export function updateMoneyString(currentValue: string, char: string): string {
    let moneyString = currentValue || '0'
    const [integer, decimal] = moneyString.split('.')

    if (char === 'b') {
        return moneyString.length > 1 ? moneyString.slice(0, -1) : '0'
    }

    if (char === '.') {
        if (!moneyString.includes('.') && integer.length < 8) {
            return moneyString + '.'
        }
        return moneyString
    }

    if (/[0-9]/.test(char)) {
        if (!decimal) {
            return moneyString === '0' ? char : (integer.length < 8 ? moneyString + char : moneyString)
        }
        if (decimal.length < 2) {
            return moneyString + char
        }
    }

    return moneyString
}
