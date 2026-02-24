import {useCallback, useEffect, useRef, useState} from 'react';
import {kernelCoreBaseCommands, RootState, storeEntry} from "@impos2/kernel-core-base";
import {kernelTerminalCommands, kernelTerminalState, KernelTerminalState, TerminalState} from "@impos2/kernel-terminal";
import {appControl} from "@impos2/kernel-core-base";
import {useSelector} from "react-redux";



export const useAppControl = () => {

    const serverSpace = storeEntry.getServerSpace();
    const spaceNames = serverSpace.spaces.map(s => s.name);
    const [selectedSpace, setSelectedSpace] = useState(serverSpace.selectedSpace);

    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const pendingRef = useRef(false);

    useEffect(() => {
        Promise.all([appControl.isFullScreen(), appControl.isAppLocked()]).then(([fs, locked]) => {
            setIsFullScreen(fs);
            setIsLocked(locked);
        });
    }, []);

    const handleToggleFullScreen = useCallback(async () => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        const next = !isFullScreen;
        try {
            await appControl.setFullScreen(next);
            setIsFullScreen(next);
        } finally {
            pendingRef.current = false;
        }
    }, [isFullScreen]);

    const handleToggleLock = useCallback(async () => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        const next = !isLocked;
        try {
            await appControl.setAppLocked(next);
            setIsLocked(next);
        } finally {
            pendingRef.current = false;
        }
    }, [isLocked]);

    const handleRestartApp = useCallback(() => appControl.restartApp(), []);
    const handleSwitchSpace = useCallback((name: string) => {
        setSelectedSpace(name);
        kernelCoreBaseCommands.switchServerSpace(name).executeInternally();
        ///
    }, []);
    const handleClearCache = useCallback(() => {
        ///
        kernelCoreBaseCommands.clearDataCache().executeInternally();
    }, []);

    return {
        isFullScreen, isLocked,
        selectedSpace, spaceNames,
        handleToggleFullScreen, handleToggleLock, handleRestartApp,
        handleSwitchSpace, handleClearCache,
    };
};
