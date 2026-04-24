import {useSelector} from 'react-redux'
import {selectUiOverlays, type UiOverlayEntry} from '@next/kernel-base-ui-runtime-v2'
import type {RootState} from '@next/kernel-base-state-runtime'

export const useUiOverlays = (
    displayMode?: string,
): readonly UiOverlayEntry[] =>
    useSelector<RootState, readonly UiOverlayEntry[]>((state) =>
        selectUiOverlays(state, displayMode),
    )
