import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text} from "react-native";

export const WorkbenchNotification: React.FC = () => {
    useLifecycle({
        componentName: 'WorkbenchNotification',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <Text>Notification</Text>
    );
};