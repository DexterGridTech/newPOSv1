import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text} from "react-native";

export const WorkbenchTitle: React.FC = () => {
    useLifecycle({
        componentName: 'WorkbenchTitle',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <Text>Title</Text>
    );
};