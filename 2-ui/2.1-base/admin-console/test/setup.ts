import React from 'react'
import {vi} from 'vitest'

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true

const originalConsoleError = console.error.bind(console)
const reactTestRendererDeprecationWarning = 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer'

console.error = (...args: Parameters<typeof console.error>) => {
    if (typeof args[0] === 'string' && args[0].includes(reactTestRendererDeprecationWarning)) {
        return
    }
    originalConsoleError(...args)
}

vi.mock('react-native-qrcode-svg', () => ({
    default: (props: Record<string, unknown>) =>
        React.createElement('mock-qr-code', props),
}))
