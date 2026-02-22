import {useCallback, useEffect, useRef, useState} from 'react';
import {kernelCoreNavigationCommands, useEditableUiVariable} from "@impos2/kernel-core-navigation";
import {uiAdminVariables} from "../ui";
import {useRequestStatus} from "@impos2/kernel-core-interconnection";
import {LOG_TAGS, logger, shortId} from "@impos2/kernel-core-base";
import {uiAdminCommands} from "../features/commands";
import {moduleName} from "../moduleName";

interface UseAdminLoginOptions {
    modalId: string;
    onComplete?: () => void;
}

export const useAdminLogin = ({modalId, onComplete}: UseAdminLoginOptions) => {
    const [requestId, setRequestId] = useState<string | null>(null);
    const handledRef = useRef<string | null>(null);

    const {value: password, setValue: setPassword} = useEditableUiVariable(uiAdminVariables.adminPassword);
    const loginStatus = useRequestStatus(requestId);

    const handleClose = useCallback(() => {
        kernelCoreNavigationCommands.closeModal({modalId}).executeInternally();
    }, [modalId]);

    useEffect(() => {
        if (loginStatus?.status === 'complete' && requestId && handledRef.current !== requestId) {
            handledRef.current = requestId;
            logger.log([moduleName, LOG_TAGS.Hook, 'useAdminLogin'], '管理员登录成功');
            onComplete ? onComplete() : handleClose();
        }
    }, [loginStatus?.status, requestId, onComplete, handleClose]);

    const handlePasswordChange = useCallback((value: string) => {
        setPassword(value);
    }, [setPassword]);

    const handleSubmit = useCallback(() => {
        if (loginStatus?.status === 'started') return;
        const id = shortId();
        setRequestId(id);
        uiAdminCommands.adminLogin({adminPassword: password}).execute(id);
    }, [loginStatus?.status, password]);

    const cleanup = useCallback(() => {
        kernelCoreNavigationCommands.clearUiVariables([uiAdminVariables.adminPassword.key]).executeInternally();
    }, []);

    return {
        password,
        loginStatus,
        handlePasswordChange,
        handleSubmit,
        handleClose,
        cleanup,
    };
};
