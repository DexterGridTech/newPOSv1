export interface SystemParametersState {
    parameters: {
        [path: string]: {
            id: string,
            key: string,
            value: any,
            updatedAt: number
        }
    }
    updatedAt?: number
}
