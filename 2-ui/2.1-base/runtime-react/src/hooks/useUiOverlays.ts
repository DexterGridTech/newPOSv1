import {useSelector} from 'react-redux'
import {selectUiOverlays, type UiOverlayEntry} from '@impos2/kernel-base-ui-runtime-v2'
import type {RootState} from '@impos2/kernel-base-state-runtime'

export const useUiOverlays = (
    displayMode?: string,
): readonly UiOverlayEntry[] =>
    useSelector<RootState, readonly UiOverlayEntry[]>((state) =>
        selectUiOverlays(state, displayMode),
    )
