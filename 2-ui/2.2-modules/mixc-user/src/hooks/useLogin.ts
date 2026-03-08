import {useCallback, useState} from 'react';

type LoginMode = 'password' | 'sms' | 'qrcode';

export const useLogin = () => {
    const [loginMode, setLoginMode] = useState<LoginMode>('password');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [smsCode, setSmsCode] = useState('');
    const [qrcodeUrl, setQrcodeUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleUsernameChange = useCallback((value: string) => {
        setUsername(value);
    }, []);

    const handlePasswordChange = useCallback((value: string) => {
        setPassword(value);
    }, []);

    const handlePhoneChange = useCallback((value: string) => {
        setPhone(value);
    }, []);

    const handleSmsCodeChange = useCallback((value: string) => {
        setSmsCode(value);
    }, []);

    const handleModeChange = useCallback((mode: LoginMode) => {
        setLoginMode(mode);
        // 切换到扫码登录时生成二维码 URL
        if (mode === 'qrcode') {
            // TODO: 调用实际的二维码生成接口
            const mockUrl = `https://example.com/qrcode/${Date.now()}`;
            setQrcodeUrl(mockUrl);
        }
    }, []);

    const handlePasswordLogin = useCallback(() => {
        if (!username || !password || isLoading) return;
        setIsLoading(true);
        // TODO: 实现用户名密码登录逻辑
        console.log('Password login:', {username, password});
        setTimeout(() => setIsLoading(false), 1000);
    }, [username, password, isLoading]);

    const handleSmsLogin = useCallback(() => {
        if (!phone || !smsCode || isLoading) return;
        setIsLoading(true);
        // TODO: 实现手机号验证码登录逻辑
        console.log('SMS login:', {phone, smsCode});
        setTimeout(() => setIsLoading(false), 1000);
    }, [phone, smsCode, isLoading]);

    const handleSendSms = useCallback(() => {
        if (!phone || isLoading) return;
        // TODO: 实现发送验证码逻辑
        console.log('Send SMS to:', phone);
    }, [phone, isLoading]);

    const cleanup = useCallback(() => {
        setUsername('');
        setPassword('');
        setPhone('');
        setSmsCode('');
        setQrcodeUrl('');
    }, []);

    return {
        loginMode,
        username,
        password,
        phone,
        smsCode,
        qrcodeUrl,
        isLoading,
        handleModeChange,
        handleUsernameChange,
        handlePasswordChange,
        handlePhoneChange,
        handleSmsCodeChange,
        handlePasswordLogin,
        handleSmsLogin,
        handleSendSms,
        cleanup,
    };
};
