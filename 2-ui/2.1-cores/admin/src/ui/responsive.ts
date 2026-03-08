import {Dimensions} from 'react-native';

export const getResponsiveLayout = () => {
    const {width, height} = Dimensions.get('window');
    const shortEdge = Math.min(width, height);
    const isMobile = shortEdge < 600;

    return {
        isMobile,
        isTablet: !isMobile,
        screenWidth: width,
        screenHeight: height,
        // Modal 尺寸
        modalWidth: isMobile ? width - 32 : Math.min(width - 48, 900),
        modalHeight: isMobile ? height - 80 : Math.min(height - 96, 600),
        // Sidebar 宽度
        sidebarWidth: isMobile ? 0 : 200,
        // 间距
        padding: isMobile ? 12 : 20,
        cardPadding: isMobile ? 12 : 16,
        gap: isMobile ? 8 : 12,
        // 字体
        titleSize: isMobile ? 18 : 22,
        sectionTitleSize: isMobile ? 10 : 11,
        textSize: isMobile ? 12 : 13,
        labelSize: isMobile ? 13 : 14,
    };
};
