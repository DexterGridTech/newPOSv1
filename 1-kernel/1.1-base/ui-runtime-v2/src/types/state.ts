import type {SyncRecordState, SyncValueEnvelope} from '@next/kernel-base-state-runtime'
import type {UiOverlayEntry, UiScreenRuntimeEntry} from './screen'

export type UiScreenRuntimeState = SyncRecordState<UiScreenRuntimeEntry | null>

export interface UiOverlayRuntimeState extends Record<string, SyncValueEnvelope<UiOverlayEntry[]>> {
    primaryOverlays: SyncValueEnvelope<UiOverlayEntry[]>
    secondaryOverlays: SyncValueEnvelope<UiOverlayEntry[]>
}

export type UiVariableRuntimeState = SyncRecordState<unknown>
