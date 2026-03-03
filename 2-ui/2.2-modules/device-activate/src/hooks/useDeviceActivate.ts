import {useCallback, useEffect, useRef, useState} from 'react';
import {kernelCoreNavigationCommands, useEditableUiVariable} from "@impos2/kernel-core-navigation";
import {uiDeviceActivateVariables} from "../ui/variables";
import {useRequestStatus} from "@impos2/kernel-core-interconnection";
import {kernelTerminalCommands, kernelTerminalState} from "@impos2/kernel-terminal";
import {LOG_TAGS, logger, RootState, shortId} from "@impos2/kernel-core-base";
import {moduleName} from "../moduleName";
import {useSelector} from "react-redux";

interface UseDeviceActivateOptions {
    onComplete?: () => void;
}

export const useDeviceActivate = ({onComplete}: UseDeviceActivateOptions = {}) => {
    const [requestId, setRequestId] = useState<string | null>(null);
    const handledRef = useRef<string | null>(null);
    const isActivated = useSelector((state: RootState) =>
        state[kernelTerminalState.terminal].terminal?.value!=null
    );
    const {value: activationCode, setValue: setActivationCode} =
        useEditableUiVariable(uiDeviceActivateVariables.activationCode);

    const activateStatus = useRequestStatus(requestId);

    useEffect(() => {
        if (activateStatus?.status === 'complete' && requestId && handledRef.current !== requestId) {
            handledRef.current = requestId;
            logger.log([moduleName,LOG_TAGS.Hook,"useDeviceActivate"],"设备激活成功",activateStatus.results)
            onComplete?.();
        }
    }, [activateStatus?.status, requestId, onComplete]);

    const handleActivationCodeChange = useCallback((value: string) => {
        setActivationCode(value);
    }, [setActivationCode]);

    const handleSubmit = useCallback(() => {
        if (activateStatus?.status === 'started') return;
        const id = shortId();
        setRequestId(id);
        kernelTerminalCommands.activateDevice(activationCode).execute(id);
    }, [activationCode, activateStatus]);

    const cleanup = useCallback(() => {
        kernelCoreNavigationCommands.clearUiVariables([uiDeviceActivateVariables.activationCode.key]).executeInternally();
    }, []);

    return {
        isActivated,
        activationCode,
        activateStatus,
        handleActivationCodeChange,
        handleSubmit,
        cleanup,
    };
};
