import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base";
import {kernelTerminalState, TerminalConnectionState} from "@impos2/kernel-terminal";

type S = RootState & {
    [kernelTerminalState.terminalConnection]: TerminalConnectionState
}

export const useTerminalConnection = () => {
    const serverConnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelTerminalState.terminalConnection]?.serverConnectionStatus
    );
    const connectedAt = useSelector((state: RootState) =>
        (state as S)[kernelTerminalState.terminalConnection]?.connectedAt
    );
    const disconnectedAt = useSelector((state: RootState) =>
        (state as S)[kernelTerminalState.terminalConnection]?.disconnectedAt
    );
    const connectionError = useSelector((state: RootState) =>
        (state as S)[kernelTerminalState.terminalConnection]?.connectionError
    );
    const connectionHistory = useSelector((state: RootState) =>
        (state as S)[kernelTerminalState.terminalConnection]?.connectionHistory ?? []
    );
    return {serverConnectionStatus, connectedAt, disconnectedAt, connectionError, connectionHistory};
};
