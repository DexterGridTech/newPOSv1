export const inputRuntimeDefaultFields = {
    username: {
        key: 'username',
        mode: 'system-text',
        persistence: 'transient',
        promptText: '请输入用户名',
    },
    password: {
        key: 'password',
        mode: 'system-password',
        persistence: 'transient',
        secureTextEntry: true,
        promptText: '请输入密码',
    },
    phone: {
        key: 'phone',
        mode: 'system-number',
        persistence: 'transient',
        promptText: '请输入11位手机号',
        maxLength: 11,
    },
    smsCode: {
        key: 'smsCode',
        mode: 'system-number',
        persistence: 'transient',
        promptText: '请输入6位验证码',
        maxLength: 6,
    },
    adminPassword: {
        key: 'adminPassword',
        mode: 'virtual-pin',
        persistence: 'transient',
        secureTextEntry: true,
        promptText: '请输入密码',
        maxLength: 6,
    },
    activationCode: {
        key: 'activationCode',
        mode: 'system-text',
        persistence: 'transient',
        promptText: '请输入激活码',
    },
} as const
