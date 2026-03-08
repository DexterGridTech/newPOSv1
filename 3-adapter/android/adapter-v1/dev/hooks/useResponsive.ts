import {useWindowDimensions} from 'react-native'

export type DeviceType = 'mobile' | 'laptop'
export type Orientation = 'portrait' | 'landscape'

export function useResponsive() {
    const {width, height} = useWindowDimensions()

    const deviceType: DeviceType = width >= 768 ? 'laptop' : 'mobile'
    const orientation: Orientation = width > height ? 'landscape' : 'portrait'
    const isSmall = deviceType === 'mobile' && orientation === 'portrait'

    return {
        width,
        height,
        deviceType,
        orientation,
        isSmall,
        isMobile: deviceType === 'mobile',
        isLaptop: deviceType === 'laptop',
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape',
    }
}
