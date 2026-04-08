import React, {useCallback, useEffect, useMemo, useRef} from "react";
import {EmptyScreen} from "../screens/EmptyScreen";
import {moduleName} from "../../moduleName";
import {getScreenPartComponentType, UiVariable, useChildScreenPart} from "@impos2/kernel-core-ui-runtime";
import {formattedTime, LOG_TAGS, logger, ScreenPart} from "@impos2/kernel-core-base";

export interface ScreenContainerProps {
    containerPart: UiVariable<ScreenPart<any>>
}

export const ScreenContainer: React.FC<ScreenContainerProps> = React.memo(({
    containerPart
}) => {
    const child = useChildScreenPart(containerPart);
    const prevChildRef = useRef<ScreenPart<any> | null>(null);
    const isMountedRef = useRef<boolean>(true);
    const currentComponentRef = useRef<string | null>(null);

    const logChildInfo = useCallback((screen: ScreenPart<any>, action: 'mount' | 'update' | 'unmount') => {
        const timestamp = formattedTime();
        const childInfo = {
            action,
            timestamp,
            partKey: screen?.partKey || 'undefined',
            props: screen?.props ? Object.keys(screen.props) : [],
            propsCount: screen?.props ? Object.keys(screen.props).length : 0,
            containerPartKey: containerPart?.key || 'undefined'
        };

        logger.log([moduleName, LOG_TAGS.UI, 'ScreenContainer'], action.toUpperCase(), childInfo);
    }, [containerPart]);

    const logComponentNotFound = useCallback((screen: ScreenPart<any>) => {
        const errorInfo = {
            timestamp: formattedTime(),
            partKey: screen?.partKey || 'undefined',
            containerPartKey: containerPart?.key || 'undefined',
            props: screen?.props || {},
            availableComponents: 'Check registered ScreenParts',
            suggestion: 'Ensure the component is registered via registerScreenPart()'
        };

        logger.error([moduleName, LOG_TAGS.UI, 'ScreenContainer'], 'Component not found', errorInfo);
        logger.debug([moduleName, LOG_TAGS.UI, 'ScreenContainer'], 'Debug Info', {
            childObject: screen,
            childType: typeof screen,
            childKeys: screen ? Object.keys(screen) : [],
            containerPart
        });
    }, [containerPart]);

    const ComponentType = useMemo(() => {
        if (!child || !child.partKey) {
            logger.warn([moduleName, LOG_TAGS.UI, 'ScreenContainer'], 'Invalid child', {child});
            return EmptyScreen;
        }
        const component = getScreenPartComponentType(child.partKey);

        if (!component) {
            logComponentNotFound(child);
            return EmptyScreen;
        }

        return component;
    }, [child, logComponentNotFound]);

    useEffect(() => {
        if (!isMountedRef.current) return;

        const prevChild = prevChildRef.current;
        const currentChild = child;

        if (!prevChild && currentChild) {
            logChildInfo(currentChild, 'mount');
            currentComponentRef.current = currentChild.partKey;
        } else if (prevChild && currentChild && prevChild.partKey !== currentChild.partKey) {
            logger.log([moduleName, LOG_TAGS.UI, 'ScreenContainer'], 'Child changed', {
                from: prevChild.partKey,
                to: currentChild.partKey,
                timestamp: formattedTime()
            });

            logChildInfo(currentChild, 'update');
            currentComponentRef.current = currentChild.partKey;
        } else if (prevChild && !currentChild) {
            logChildInfo(prevChild, 'unmount');
            currentComponentRef.current = null;
        }

        prevChildRef.current = currentChild;
    }, [child, logChildInfo]);

    useEffect(() => {
        isMountedRef.current = true;

        logger.log([moduleName, LOG_TAGS.UI, 'ScreenContainer'], 'Container mounted', {
            containerPartKey: containerPart?.key || 'undefined',
            timestamp: formattedTime()
        });

        return () => {
            isMountedRef.current = false;

            if (currentComponentRef.current) {
                logger.log([moduleName, LOG_TAGS.UI, 'ScreenContainer'], 'Container unmounting', {
                    lastComponent: currentComponentRef.current,
                    timestamp: formattedTime()
                });
            }

            prevChildRef.current = null;
            currentComponentRef.current = null;

            logger.log([moduleName, LOG_TAGS.UI, 'ScreenContainer'], 'Container unmounted and resources released');
        };
    }, [containerPart]);

    if (!child) {
        logger.warn([moduleName, LOG_TAGS.UI, 'ScreenContainer'], 'No child to render', {
            containerPartKey: containerPart?.key || 'undefined'
        });
        return <EmptyScreen/>;
    }

    return <ComponentType {...child.props} />;
}, (prevProps, nextProps) => {
    return prevProps.containerPart === nextProps.containerPart;
});
