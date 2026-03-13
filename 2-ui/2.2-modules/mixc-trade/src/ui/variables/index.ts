import {emptyScreenPart} from "@impos2/ui-core-base";
import {OrderCreationType} from "../../types/shared/orderCreationType";

export const uiMixcTradeVariables = {
    mixcTradePanelContainer: {key: "mixc.trade.panel.container", defaultValue: emptyScreenPart},
    orderCreationType: {key: 'order.creation.type', defaultValue: 'active' as OrderCreationType},
}