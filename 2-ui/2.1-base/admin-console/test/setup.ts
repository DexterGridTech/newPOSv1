import React from 'react'
import {vi} from 'vitest'

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-native-qrcode-svg', () => ({
    default: (props: Record<string, unknown>) =>
        React.createElement('mock-qr-code', props),
}))
