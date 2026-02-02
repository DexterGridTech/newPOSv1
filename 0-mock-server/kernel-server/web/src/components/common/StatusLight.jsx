/**
 * 状态指示灯组件
 * 绿灯(true)或红灯(false)
 */
export function StatusLight({ status, size = 'md' }) {
    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4',
    };
    return (<div className={`${sizeClasses[size]} rounded-full ${status ? 'bg-green-500' : 'bg-red-500'}`} title={status ? '启用' : '停用'}/>);
}
//# sourceMappingURL=StatusLight.js.map