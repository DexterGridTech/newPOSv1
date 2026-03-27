import {useCallback} from 'react';
import {kernelCoreNavigationCommands} from '@impos2/kernel-core-navigation';
import {createOrderActiveScreenPart} from "../ui/screens/CreateOrderActiveScreen";
import {OrderCreationType} from "../types/shared/orderCreationType";
import {useSelector} from "react-redux";
import {selectOrderCreationType} from "../selectors/selectOrderCreation";
import {createOrderPassiveScreenPart} from "../ui/screens/CreateOrderPassiveScreen";
import {shortId} from "@impos2/kernel-core-base";

export const useCreateOrderButton = () => {
    const orderCreationType = useSelector(selectOrderCreationType);

    const handlePress = useCallback(() => {
        if (orderCreationType === OrderCreationType.Active) {
            kernelCoreNavigationCommands.navigateTo({
                target: createOrderActiveScreenPart
            }).execute(shortId())
        }else {
            kernelCoreNavigationCommands.navigateTo({
                target: createOrderPassiveScreenPart
            }).execute(shortId())
        }

    }, []);

    return {
        orderCreationType: orderCreationType ?? OrderCreationType.Active,
        handlePress,
    };
};
