export function updateValueStr(currentValue: string, char: string): string {
    let valueStr = currentValue || '0'
    const [integer, decimal] = valueStr.split('.')

    if(char === 'b'){
        return valueStr.length > 1 ? valueStr.slice(0, -1) : '0'
    }

    if(char === '.'){
        if(!valueStr.includes('.') && integer.length < 8){
            return valueStr + '.'
        }
        return valueStr
    }

    if(/[0-9]/.test(char)){
        if(!decimal){
            return valueStr === '0' ? char : (integer.length < 8 ? valueStr + char : valueStr)
        }
        if(decimal.length < 2){
            return valueStr + char
        }
    }

    return valueStr
}
