import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {PayingOrderActor} from "./payingOrder";
import {PaymentRequestActor} from "./paymentRequest";


export const kernelPayBaseActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    payingOrderActor:PayingOrderActor,
    paymentRequestActor:PaymentRequestActor
});
