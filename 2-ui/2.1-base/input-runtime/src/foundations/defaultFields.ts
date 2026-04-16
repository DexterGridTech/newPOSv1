import {defineInputField} from './inputFieldFactory'

export const inputRuntimeDefaultFields = {
    username: defineInputField({
        key: 'username',
        mode: 'system-text',
        promptText: '请输入用户名',
    }),
    password: defineInputField({
        key: 'password',
        mode: 'system-password',
        secureTextEntry: true,
        promptText: '请输入密码',
    }),
    phone: defineInputField({
        key: 'phone',
        mode: 'system-number',
        promptText: '请输入11位手机号',
        maxLength: 11,
    }),
    smsCode: defineInputField({
        key: 'smsCode',
        mode: 'system-number',
        promptText: '请输入6位验证码',
        maxLength: 6,
    }),
    adminPassword: defineInputField({
        key: 'adminPassword',
        mode: 'virtual-pin',
        secureTextEntry: true,
        promptText: '请输入密码',
        maxLength: 6,
    }),
    activationCode: defineInputField({
        key: 'activationCode',
        mode: 'system-text',
        promptText: '请输入激活码',
    }),
} as const
