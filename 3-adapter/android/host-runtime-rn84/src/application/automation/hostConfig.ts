export const ASSEMBLY_AUTOMATION_PRIMARY_PORT = 18_584
export const ASSEMBLY_AUTOMATION_SECONDARY_PORT = 18_585

export interface AssemblyAutomationHostConfig {
    readonly host: '127.0.0.1'
    readonly port: number
    readonly target: 'primary' | 'secondary'
}

export const getAssemblyAutomationHostConfig = (
    displayIndex: number,
): AssemblyAutomationHostConfig => {
    const secondary = displayIndex > 0
    return {
        host: '127.0.0.1',
        port: secondary
            ? ASSEMBLY_AUTOMATION_SECONDARY_PORT
            : ASSEMBLY_AUTOMATION_PRIMARY_PORT,
        target: secondary ? 'secondary' : 'primary',
    }
}
