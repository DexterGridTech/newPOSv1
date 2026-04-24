import React from 'react'
import {vi} from 'vitest'

vi.mock('react-native-qrcode-svg', () => ({
    default: (props: Record<string, unknown>) => React.createElement('mock-qrcode-svg', props),
}))
