import {Unit} from "../features";

export interface TerminalInfoState {
    terminal?: Unit | null
    model?: Unit | null
    hostEntity?: Unit | null
    operatingEntity?: Unit | null
    token?: string | null
    updatedAt?: number | null
}
