export interface User {
    id: string
    userName: string
    name: string
    mobile: string
    userRoles: UserRole[]
}

export interface UserRole{
    key: string
    name: string
}