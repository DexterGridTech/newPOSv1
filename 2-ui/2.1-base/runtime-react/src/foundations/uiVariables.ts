import type {UiRuntimeVariable} from '../types'

export const uiRuntimeRootVariables = {
    primaryRootContainer: {
        key: 'primary.root.container',
        persistence: 'recoverable',
    },
    secondaryRootContainer: {
        key: 'secondary.root.container',
        persistence: 'recoverable',
    },
} satisfies Record<string, UiRuntimeVariable>
