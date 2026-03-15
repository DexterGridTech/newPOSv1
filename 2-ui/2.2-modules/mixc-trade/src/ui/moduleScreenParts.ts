import {mpMainScreenPart, spMainScreenPart} from "./screens/MainScreen";
import {
    createOrderActiveScreenPart,
} from "./screens/CreateOrderActiveScreen";
import {createOrderPassiveScreenPart} from "./screens/CreateOrderPassiveScreen";

export const uiMixcTradeScreenParts = {
    mpMainScreen:mpMainScreenPart,
    spMainScreen:spMainScreenPart,
    createOrderActiveScreen:createOrderActiveScreenPart,
    createOrderPassiveScreen:createOrderPassiveScreenPart
}