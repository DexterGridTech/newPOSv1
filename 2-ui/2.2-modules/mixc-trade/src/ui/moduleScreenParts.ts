import {mpMainScreenPart, spMainScreenPart} from "./screens/MainScreen";
import {
    createOrderActiveScreenPart,
} from "./screens/CreateOrderActiveScreen";
import {createOrderPassiveScreenPart} from "./screens/CreateOrderPassiveScreen";
import {payingOrderScreenPart} from "./screens/PayingOrderScreen";
import {paymentModalPart} from "./modals/PaymentModal";

export const uiMixcTradeScreenParts = {
    mpMainScreen:mpMainScreenPart,
    spMainScreen:spMainScreenPart,
    createOrderActiveScreen:createOrderActiveScreenPart,
    createOrderPassiveScreen:createOrderPassiveScreenPart,
    payingOrderScreen:payingOrderScreenPart,
    paymentModal:paymentModalPart
}