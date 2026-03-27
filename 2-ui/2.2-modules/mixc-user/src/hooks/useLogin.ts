import {useCallback, useEffect, useRef, useState} from 'react';
import {useEditableUiVariable} from "@impos2/kernel-core-navigation";
import {uiMixcUserVariables} from "../ui/variables";
import {LOG_TAGS, logger, shortId} from "@impos2/kernel-core-base";
import {useRequestStatus} from "@impos2/kernel-core-interconnection";
import {kernelUserBaseCommands} from "@impos2/kernel-user-base";
import {moduleName} from "../moduleName";

type LoginMode = 'password' | 'sms' | 'qrcode';

export const useLogin = () => {
    const {value: loginMode, setValue: setLoginMode} = useEditableUiVariable(uiMixcUserVariables.loginMode);
    const {value: username, setValue: setUsername} = useEditableUiVariable(uiMixcUserVariables.username);
    const {value: password, setValue: setPassword} = useEditableUiVariable(uiMixcUserVariables.password);
    const {value: phone, setValue: setPhone} = useEditableUiVariable(uiMixcUserVariables.phone);
    const {value: qrcodeUrl, setValue: setQrcodeUrl} = useEditableUiVariable(uiMixcUserVariables.qrcodeUrl);
    const [smsCode, setSmsCode] = useState('');
    const [requestId, setRequestId] = useState<string | null>(null);
    const handledRef = useRef<string | null>(null);
    const loginStatus = useRequestStatus(requestId);
    useEffect(() => {
        if (loginStatus?.status === 'complete' && requestId && handledRef.current !== requestId) {
            handledRef.current = requestId;
            logger.log([moduleName, LOG_TAGS.Hook, 'useLogin'], '用户登录成功');
        }
    }, [loginStatus?.status, requestId]);
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
        if (loginStatus?.status === 'started') return;
        const id = shortId();
        setRequestId(id);
        kernelUserBaseCommands.loginWithPassword({userName: username, password: password}).execute(id);
    }, [loginStatus?.status, username, password]);

    const handleSmsLogin = useCallback(() => {
        // TODO: 实现手机号验证码登录逻辑
        console.log('SMS login:', {phone, smsCode});
    }, [phone, smsCode]);

    const handleSendSms = useCallback(() => {
        // TODO: 实现发送验证码逻辑
        console.log('Send SMS to:', phone);
    }, [phone]);

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
        loginStatus,
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
