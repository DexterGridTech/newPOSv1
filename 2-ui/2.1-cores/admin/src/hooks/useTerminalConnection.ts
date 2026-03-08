import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base";
import {kernelCoreTerminalState, TerminalConnectionState} from "@impos2/kernel-core-terminal";

type S = RootState & {
    [kernelCoreTerminalState.terminalConnection]: TerminalConnectionState
}

export const useTerminalConnection = () => {
    const serverConnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.serverConnectionStatus
    );
    const connectedAt = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.connectedAt
    );
    const disconnectedAt = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.disconnectedAt
    );
    const connectionError = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.connectionError
    );
    const connectionHistory = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.connectionHistory ?? []
    );
    return {serverConnectionStatus, connectedAt, disconnectedAt, connectionError, connectionHistory};
};
