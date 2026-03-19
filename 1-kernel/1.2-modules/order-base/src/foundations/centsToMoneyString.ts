/**
 * 将整数分转为可编辑的元字符串
 * 例：764355 -> "7643.55"，100000 -> "1000"，100050 -> "1000.5"
 */
export function centsToMoneyString(cents: number): string {
    const yuan = cents / 100
    // toFixed(2) 保证精度，parseFloat 去掉末尾多余的零
    return parseFloat(yuan.toFixed(2)).toString()
}

/**
 * 将元字符串转为整数分（四舍五入）
 * 例："7643.55" -> 764355，"1000" -> 100000
 */
export function moneyStringToCents(moneyString: string): number {
    return Math.round(parseFloat(moneyString || '0') * 100)
}
