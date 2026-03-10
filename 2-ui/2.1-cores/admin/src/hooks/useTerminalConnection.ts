import {useSelector} from "react-redux";
import {RootState} from "@impos2/kernel-core-base";
import {kernelCoreTerminalState, TerminalConnectionState} from "@impos2/kernel-core-terminal";

type S = RootState & {
    [kernelCoreTerminalState.terminalConnection]: TerminalConnectionState
}

export const useTerminalConnection = () => {
    const serverConnectionStatus = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.serverConnectionStatus?.value
    );
    const connectedAt = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.connectedAt?.value
    );
    const disconnectedAt = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.disconnectedAt?.value
    );
    const connectionError = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.connectionError?.value
    );
    const connectionHistory = useSelector((state: RootState) =>
        (state as S)[kernelCoreTerminalState.terminalConnection]?.connectionHistory?.value ?? []
    );
    return {serverConnectionStatus, connectedAt, disconnectedAt, connectionError, connectionHistory};
};
